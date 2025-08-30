// src/api.ts
// Main API implementation for @sage/llm

import type { ChatOptions, StreamEvent, StreamOptions, ToolCallInfo, ToolSchema } from "./types.js";
import { getProvider, setProvider as _setProvider, listModels as _listModels } from "./registry.js";
import { AsyncQueue, withErrorBoundary } from "./stream-utils.js";
import { ToolCallManager } from "./tool-lifecycle.js";
import { ToolValidator } from "./tool-validation.js";
import { SecurityPolicyManager } from "./security-policies.js";
import { defaultCacheManager } from "./cache/index.js";
import type { CacheOptions } from "./cache/index.js";

// Global tool system instances
const globalToolValidator = new ToolValidator();
const globalSecurityPolicyManager = new SecurityPolicyManager();
const globalToolCallManager = new ToolCallManager();

// Wire up the tool system
globalToolValidator.setApprovalPolicy(
  globalSecurityPolicyManager.createPolicyFunction()
);
globalToolCallManager.setValidator(globalToolValidator);

/**
 * Create a chat stream with the current provider, with optional caching
 * @param opts Chat options including model, messages, and other parameters
 * @param streamOpts Stream configuration options
 * @returns Async iterable of stream events
 */
export async function createChatStream(
  opts: ChatOptions, 
  streamOpts: StreamOptions = {}
): Promise<AsyncIterable<StreamEvent>> {
  const provider = getProvider();
  
  if (!provider) {
    throw new Error("No LLM provider configured. Use setProvider() to configure a provider.");
  }
  
  // Apply default options
  const normalizedOpts = {
    timeoutMs: 30000, // Default 30 second timeout
    ...opts
  };

  // Apply default stream options
  const normalizedStreamOpts = {
    maxBufferSize: 1000,
    eventTimeoutMs: 5000,
    enableRoundEvents: true,
    enableToolValidation: true,
    ...streamOpts
  };
  
  // Validate required options
  if (!normalizedOpts.model) {
    throw new Error("Model is required");
  }
  
  if (!Array.isArray(normalizedOpts.messages)) {
    throw new Error("Messages must be an array");
  }
  
  // Handle caching if enabled
  if (normalizedOpts.cache && normalizedOpts.cache.mode !== "bypass") {
    const cacheOptions: CacheOptions = {
      mode: normalizedOpts.cache.mode,
      hashPrompts: normalizedOpts.cache.hashPrompts ?? false,
      ttlMs: normalizedOpts.cache.ttlMs,
      maxEntries: normalizedOpts.cache.maxEntries
    };
    
    // Try cache lookup
    const cacheLookup = await defaultCacheManager.lookup(normalizedOpts, cacheOptions);
    
    if (cacheLookup.hit && cacheLookup.events) {
      // Return cached events as a stream
      return defaultCacheManager.eventsToStream(cacheLookup.events);
    }
    
    // Cache miss - get result from provider and cache it
    const stream = await callProviderWithTimeout(provider, normalizedOpts, normalizedStreamOpts);
    return withCaching(stream, cacheLookup.cacheKey, cacheOptions, provider.name, normalizedOpts.model);
  }
  
  // No caching - call provider directly
  return callProviderWithTimeout(provider, normalizedOpts, normalizedStreamOpts);
}

/**
 * Call provider with timeout handling
 */
async function callProviderWithTimeout(
  provider: any, 
  normalizedOpts: ChatOptions, 
  normalizedStreamOpts: Required<StreamOptions>
): Promise<AsyncIterable<StreamEvent>> {
  try {
    const controller = new AbortController();
    const timeoutId = normalizedOpts.timeoutMs ? setTimeout(() => {
      controller.abort();
    }, normalizedOpts.timeoutMs) : null;
    
    // Add abort signal to options if we have a timeout
    const chatOpts = timeoutId ? {
      ...normalizedOpts,
      signal: controller.signal
    } : normalizedOpts;
    
    const result = await provider.chat(chatOpts as ChatOptions);
    
    // DON'T clear the timeout - let it stay active during streaming
    // The abort controller will stay active and the stream processing will respect it
    
    // Wrap streaming result with timeout cleanup and error boundaries
    async function* streamWithCleanup() {
      try {
        for await (const event of enhanceStreamWithRounds(result, normalizedStreamOpts)) {
          yield event;
          // Clear timeout on successful end event
          if (event.type === 'end' && timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (error) {
        // Clear timeout on any error
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        throw error;
      }
    }
    
    return withErrorBoundary(
      streamWithCleanup(),
      (error) => {
        console.error(`Stream error from provider ${provider.name}:`, error);
        return { type: "error", error: error.message, recoverable: false } as StreamEvent;
      }
    );
  } catch (error) {
    // Check if it's an abort error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Provider ${provider.name} timeout after ${normalizedOpts.timeoutMs}ms`);
    }
    // Add provider context to other errors
    throw new Error(`Provider ${provider.name} error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Wrap a stream with caching functionality
 */
async function* withCaching(
  stream: AsyncIterable<StreamEvent>,
  cacheKey: string,
  cacheOptions: CacheOptions,
  providerName: string,
  model: string
): AsyncIterable<StreamEvent> {
  const events: StreamEvent[] = [];
  let usage: { prompt: number; completion: number } | undefined;
  
  try {
    for await (const event of stream) {
      // Collect events for caching
      events.push(event);
      
      // Extract usage information if present
      if (event.type === "end" && event.usage) {
        usage = event.usage;
      }
      
      yield event;
    }
    
    // Store in cache after successful completion
    await defaultCacheManager.store(cacheKey, events, cacheOptions, {
      provider: providerName,
      model,
      usage
    });
    
  } catch (error) {
    // Don't cache on error, just re-throw
    throw error;
  }
}

/**
 * Enhance a stream with round events, tool validation, and proper lifecycle management
 */
async function* enhanceStreamWithRounds(
  stream: AsyncIterable<StreamEvent>,
  streamOpts: Required<StreamOptions>
): AsyncIterable<StreamEvent> {
  let currentRound = 0;
  let roundStarted = false;
  let hasEmittedContent = false;

  try {
    for await (const event of stream) {
      // Handle tool validation if enabled
      if (streamOpts.enableToolValidation && event.type === 'tool_call') {
        // Process the tool call through the validation system
        const processedEvents = await globalToolCallManager.processToolCall(event);
        
        for (const processedEvent of processedEvents) {
          // Handle round lifecycle for each processed event
          if (streamOpts.enableRoundEvents) {
            // Start a round if we see content and haven't started one yet
            if (!roundStarted && (processedEvent.type === 'text' || processedEvent.type === 'tool_call')) {
              yield { type: "round_start", index: currentRound };
              roundStarted = true;
            }
            
            // End a round if we see an end event
            if (roundStarted && processedEvent.type === 'end') {
              yield { type: "round_end", index: currentRound };
              roundStarted = false;
              currentRound++;
            }
          }

          // Track if we've emitted any content
          if (processedEvent.type === 'text' || processedEvent.type === 'tool_call' || processedEvent.type === 'tool_result') {
            hasEmittedContent = true;
          }

          yield processedEvent;
        }
        continue;
      }

      // Handle round lifecycle for non-tool events
      if (streamOpts.enableRoundEvents) {
        // Start a round if we see content and haven't started one yet
        if (!roundStarted && (event.type === 'text' || event.type === 'tool_call')) {
          yield { type: "round_start", index: currentRound };
          roundStarted = true;
        }
        
        // End a round if we see an end event
        if (roundStarted && event.type === 'end') {
          yield { type: "round_end", index: currentRound };
          roundStarted = false;
          currentRound++;
        }
      }

      // Track if we've emitted any content
      if (event.type === 'text' || event.type === 'tool_call' || event.type === 'tool_result') {
        hasEmittedContent = true;
      }

      yield event;
    }

    // Ensure we end any open round
    if (streamOpts.enableRoundEvents && roundStarted) {
      yield { type: "round_end", index: currentRound };
    }

    // If no content was emitted and no end event was seen, emit one
    if (!hasEmittedContent) {
      yield { type: "end" };
    }

  } catch (error) {
    // Clean up any open round
    if (streamOpts.enableRoundEvents && roundStarted) {
      yield { type: "round_end", index: currentRound };
    }
    
    // Re-throw the error to be caught by error boundary
    throw error;
  }
}

/**
 * Register a tool with the global tool system
 */
export function registerTool(toolName: string, schema: ToolSchema, executor: (args: unknown) => Promise<unknown> | unknown): void {
  globalToolCallManager.registerTool(toolName, schema, async (args, callInfo) => {
    return executor(args);
  });
}

/**
 * Unregister a tool from the global tool system
 */
export function unregisterTool(toolName: string): void {
  globalToolCallManager.unregisterTool(toolName);
}

/**
 * Get the global tool validator instance
 */
export function getToolValidator(): ToolValidator {
  return globalToolValidator;
}

/**
 * Get the global security policy manager instance
 */
export function getSecurityPolicyManager(): SecurityPolicyManager {
  return globalSecurityPolicyManager;
}

/**
 * Get the global tool call manager instance
 */
export function getToolCallManager(): ToolCallManager {
  return globalToolCallManager;
}

/**
 * Configure tool validation and security options
 */
export function configureToolSecurity(options: {
  allowedTools?: string[];
  deniedTools?: string[];
  customPolicies?: Record<string, (callInfo: ToolCallInfo) => Promise<'approved' | 'denied'> | 'approved' | 'denied'>;
} = {}): void {
  if (options.allowedTools) {
    globalSecurityPolicyManager.addToAllowlist(options.allowedTools);
  }
  
  if (options.deniedTools) {
    globalSecurityPolicyManager.addToDenylist(options.deniedTools);
  }
  
  if (options.customPolicies) {
    for (const [name, policy] of Object.entries(options.customPolicies)) {
      globalSecurityPolicyManager.registerPolicy(name, policy);
    }
  }
}

/**
 * Get cache metrics for monitoring cache performance
 */
export function getCacheMetrics() {
  return defaultCacheManager.getMetrics();
}

/**
 * Clear the cache
 */
export async function clearCache(): Promise<void> {
  await defaultCacheManager.clear();
}

/**
 * Get current cache size
 */
export async function getCacheSize(): Promise<number> {
  return defaultCacheManager.size();
}

/**
 * Configure global cache settings (for future extensibility)
 */
export function configureCache(options: {
  defaultTtlMs?: number;
  maxEntries?: number;
} = {}): void {
  // For now this is a no-op, but provides API for future cache configuration
  // In the future, we could allow swapping out the cache implementation
}

/**
 * Type guard to check if a value is an AsyncIterable
 */
function isAsyncIterable<T>(value: any): value is AsyncIterable<T> {
  return value && typeof value[Symbol.asyncIterator] === 'function';
}

/**
 * Re-export registry functions for convenience
 */
export const setProvider = _setProvider;
export const listModels = _listModels;