// src/event-normalization.ts
// Event normalization layer for different provider implementations

import type { StreamEvent, LLMProvider, ChatOptions } from "./types.js";
import { AsyncQueue } from "./stream-utils.js";

/**
 * Provider-specific event transformation interface
 */
export interface EventNormalizer {
  name: string;
  normalizeEvent(rawEvent: any, context: NormalizationContext): StreamEvent | StreamEvent[] | null;
  isProviderEvent(rawEvent: any): boolean;
}

/**
 * Context information for event normalization
 */
export interface NormalizationContext {
  requestId: string;
  provider: string;
  model: string;
  round: number;
  callIdMap: Map<string, string>; // Maps provider callIds to normalized callIds
}

/**
 * Registry of event normalizers for different providers
 */
class EventNormalizerRegistry {
  private normalizers = new Map<string, EventNormalizer>();

  register(normalizer: EventNormalizer): void {
    this.normalizers.set(normalizer.name, normalizer);
  }

  get(providerName: string): EventNormalizer | undefined {
    return this.normalizers.get(providerName);
  }

  getNormalizer(rawEvent: any): EventNormalizer | undefined {
    for (const normalizer of this.normalizers.values()) {
      if (normalizer.isProviderEvent(rawEvent)) {
        return normalizer;
      }
    }
    return undefined;
  }
}

// Global registry instance
const registry = new EventNormalizerRegistry();

/**
 * Register an event normalizer for a provider
 */
export function registerEventNormalizer(normalizer: EventNormalizer): void {
  registry.register(normalizer);
}

/**
 * Normalize events from a raw stream into standard StreamEvents
 */
export async function* normalizeEventStream(
  rawStream: AsyncIterable<any>,
  context: NormalizationContext
): AsyncIterable<StreamEvent> {
  const normalizer = registry.get(context.provider);
  
  if (!normalizer) {
    // Fallback: assume events are already in StreamEvent format
    for await (const event of rawStream) {
      if (isValidStreamEvent(event)) {
        yield event;
      } else {
        console.warn(`Unknown event format from provider ${context.provider}:`, event);
      }
    }
    return;
  }

  for await (const rawEvent of rawStream) {
    try {
      const normalizedEvents = normalizer.normalizeEvent(rawEvent, context);
      
      if (normalizedEvents === null) {
        continue; // Skip this event
      }
      
      // Handle both single events and arrays of events
      const events = Array.isArray(normalizedEvents) ? normalizedEvents : [normalizedEvents];
      
      for (const event of events) {
        yield event;
      }
    } catch (error) {
      console.error(`Event normalization error for provider ${context.provider}:`, error);
      yield {
        type: "error",
        error: `Event normalization failed: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: true
      };
    }
  }
}

/**
 * Wrap a provider to automatically normalize its events
 */
export function withEventNormalization(provider: LLMProvider): LLMProvider {
  return {
    name: provider.name,
    models: provider.models.bind(provider),
    
    async chat(opts: ChatOptions) {
      const result = await provider.chat(opts);
      
      // If the result is not a stream, return as-is
      if (!isAsyncIterable(result)) {
        return result;
      }
      
      // Create normalization context
      const context: NormalizationContext = {
        requestId: opts.requestId || generateRequestId(),
        provider: provider.name,
        model: opts.model,
        round: 0,
        callIdMap: new Map()
      };
      
      // Return normalized stream
      return normalizeEventStream(result, context);
    }
  };
}

/**
 * Built-in normalizers for common provider patterns
 */

// OpenAI-style event normalizer
export const OpenAIEventNormalizer: EventNormalizer = {
  name: "openai",
  
  isProviderEvent(rawEvent: any): boolean {
    return rawEvent && 
           typeof rawEvent === 'object' && 
           ('choices' in rawEvent || 'delta' in rawEvent || 'tool_calls' in rawEvent);
  },
  
  normalizeEvent(rawEvent: any, context: NormalizationContext): StreamEvent | StreamEvent[] | null {
    // Handle OpenAI streaming response format
    if (rawEvent.choices && rawEvent.choices[0]) {
      const choice = rawEvent.choices[0];
      
      // Text content
      if (choice.delta?.content) {
        return { type: "text", value: choice.delta.content };
      }
      
      // Tool calls
      if (choice.delta?.tool_calls) {
        const events: StreamEvent[] = [];
        
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.function) {
            const callId = generateCallId();
            context.callIdMap.set(toolCall.id, callId);
            
            events.push({
              type: "tool_call",
              toolName: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments || '{}'),
              callId
            });
          }
        }
        
        return events.length > 0 ? events : null;
      }
      
      // End of stream
      if (choice.finish_reason) {
        const events: StreamEvent[] = [];
        
        // Add usage info if available
        if (rawEvent.usage) {
          events.push({
            type: "end",
            usage: {
              prompt: rawEvent.usage.prompt_tokens,
              completion: rawEvent.usage.completion_tokens
            }
          });
        } else {
          events.push({ type: "end" });
        }
        
        return events;
      }
    }
    
    return null;
  }
};

// Anthropic-style event normalizer
export const AnthropicEventNormalizer: EventNormalizer = {
  name: "anthropic",
  
  isProviderEvent(rawEvent: any): boolean {
    return rawEvent && 
           typeof rawEvent === 'object' && 
           ('type' in rawEvent) &&
           (rawEvent.type === 'content_block_delta' || 
            rawEvent.type === 'content_block_start' || 
            rawEvent.type === 'message_delta' ||
            rawEvent.type === 'message_stop');
  },
  
  normalizeEvent(rawEvent: any, context: NormalizationContext): StreamEvent | StreamEvent[] | null {
    switch (rawEvent.type) {
      case 'content_block_delta':
        if (rawEvent.delta?.text) {
          return { type: "text", value: rawEvent.delta.text };
        }
        break;
        
      case 'content_block_start':
        if (rawEvent.content_block?.type === 'tool_use') {
          const callId = generateCallId();
          context.callIdMap.set(rawEvent.content_block.id, callId);
          
          return {
            type: "tool_call",
            toolName: rawEvent.content_block.name,
            arguments: rawEvent.content_block.input || {},
            callId
          };
        }
        break;
        
      case 'message_delta':
        if (rawEvent.usage) {
          return {
            type: "end",
            usage: {
              prompt: rawEvent.usage.input_tokens,
              completion: rawEvent.usage.output_tokens
            }
          };
        }
        break;
        
      case 'message_stop':
        return { type: "end" };
    }
    
    return null;
  }
};

// Register built-in normalizers
registerEventNormalizer(OpenAIEventNormalizer);
registerEventNormalizer(AnthropicEventNormalizer);

/**
 * Helper functions
 */

function isAsyncIterable<T>(value: any): value is AsyncIterable<T> {
  return value && typeof value[Symbol.asyncIterator] === 'function';
}

function isValidStreamEvent(event: any): event is StreamEvent {
  return event && 
         typeof event === 'object' && 
         'type' in event &&
         ['text', 'tool_call', 'tool_result', 'tool_validation_error', 'round_start', 'round_end', 'error', 'end'].includes(event.type);
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}