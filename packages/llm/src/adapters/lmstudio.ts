// src/adapters/lmstudio.ts
// LM Studio adapter with act-loop bridge compatibility

import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema, ToolCallInfo, ModelInfo } from '../types.js';
import { BaseAdapter, type ProviderConfig, ProviderError } from './base.js';
import { AsyncQueue } from '../stream-utils.js';

/**
 * LM Studio-specific configuration
 */
export interface LMStudioConfig extends ProviderConfig {
  // LM Studio dependencies injection
  deps?: LMStudioDeps;
}

/**
 * LM Studio SDK types (external dependencies)
 */
export interface Chat {
  // Opaque LM Studio chat session
}

export interface LMStudioModel {
  act(
    chat: Chat,
    tools: Record<string, unknown>,
    callbacks: {
      signal?: AbortSignal;
      onRoundStart?: (roundIndex: number) => void;
      onRoundEnd?: (roundIndex: number) => void;
      onPredictionFragment?: (text: string) => void;
      onPredictionCompleted?: (text: string) => void;
      onToolCallRequestStart?: (
        roundIndex: number,
        callId: string,
        info: { toolCallId: string }
      ) => void;
      onToolCallRequestNameReceived?: (
        roundIndex: number,
        callId: string,
        name: string
      ) => void;
      onToolCallRequestArgumentFragmentGenerated?: (
        roundIndex: number,
        callId: string,
        fragment: string
      ) => void;
      onToolCallRequestEnd?: (
        roundIndex: number,
        callId: string,
        info: { toolCallId?: string }
      ) => void;
      onMessage?: (message: { getRole(): string }) => void;
      guardToolCall?: (
        roundIndex: number,
        callId: string,
        controller: {
          toolCallRequest: { id: string; name: string; arguments: unknown };
          allow(): void;
          deny(reason: string): void;
        }
      ) => Promise<void> | void;
    }
  ): Promise<void>;
}

export interface LMStudioDeps {
  getSelectedModel(): Promise<LMStudioModel | null>;
  createChatSession(
    model: LMStudioModel,
    opts: { messages: ChatMessage[] }
  ): Promise<Chat>;
  toolsRegistry: { getLMStudioTools(): Record<string, unknown> };
}

/**
 * LM Studio adapter implementation with act-loop bridge
 */
export class LMStudioAdapter extends BaseAdapter {
  private deps?: LMStudioDeps;

  constructor(config: LMStudioConfig = {}) {
    super('lm-studio', config);
    this.deps = config.deps;
  }

  /**
   * Set LM Studio dependencies (for runtime injection)
   */
  setDeps(deps: LMStudioDeps): void {
    this.deps = deps;
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    if (!this.deps) {
      throw new ProviderError(
        'LM Studio dependencies not configured. Use setDeps() or pass deps in constructor.',
        'DEPS_NOT_CONFIGURED'
      );
    }

    this.validateChatOptions(opts);

    const model = await this.deps.getSelectedModel();
    if (!model) {
      throw new ProviderError('LM Studio: no model selected', 'NO_MODEL_SELECTED');
    }

    // Create or reuse chat session
    const chat = await this.createOrReuseChatSession(model, opts);

    // Create async queue for backpressure-friendly streaming
    const queue = new AsyncQueue<StreamEvent>();
    let streamEnded = false;

    // Tool call assembly state (for streaming arg fragments)
    const toolArgBuffers = new Map<string, { name?: string; args: string[] }>();

    // Guard policy from options or default
    const guardPolicy = opts.guardToolCall || this.defaultGuardPolicy;

    // Set up abort handling
    const aborter = new AbortController();
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => aborter.abort());
    }

    // Start the LM Studio act loop in background
    const actPromise = this.runActLoop(
      model,
      chat,
      queue,
      toolArgBuffers,
      guardPolicy,
      aborter.signal
    );

    // Handle act loop completion/errors
    actPromise
      .then(() => {
        if (!streamEnded) {
          queue.push({ type: 'end' });
          queue.finish();
          streamEnded = true;
        }
      })
      .catch(error => {
        if (!streamEnded) {
          queue.fail(error);
          streamEnded = true;
        }
      });

    // Return the async iterator
    yield* queue;
  }

  async models(): Promise<ModelInfo[]> {
    if (!this.deps) {
      return []; // No deps available, return empty list
    }

    // LM Studio doesn't have a direct models API in the act bridge
    // Return a placeholder that indicates local model support
    return [
      {
        id: 'local-model',
        name: 'Local LM Studio Model',
        description: 'Currently selected model in LM Studio',
        supportsStreaming: true,
        supportsToolCalls: true,
        contextWindow: 4096, // Default, actual depends on loaded model
        maxTokens: 4096
      }
    ];
  }

  /**
   * Create or reuse chat session
   */
  private async createOrReuseChatSession(model: LMStudioModel, opts: ChatOptions): Promise<Chat> {
    if (!this.deps) {
      throw new ProviderError('LM Studio dependencies not available', 'DEPS_NOT_CONFIGURED');
    }

    // Check if chat session is provided in options
    if ((opts as any).chat) {
      return (opts as any).chat;
    }

    // Create new chat session
    return this.deps.createChatSession(model, { messages: opts.messages });
  }

  /**
   * Run the LM Studio act loop
   */
  private async runActLoop(
    model: LMStudioModel,
    chat: Chat,
    queue: AsyncQueue<StreamEvent>,
    toolArgBuffers: Map<string, { name?: string; args: string[] }>,
    guardPolicy: (info: ToolCallInfo) => Promise<'approved' | 'denied'> | 'approved' | 'denied',
    signal: AbortSignal
  ): Promise<void> {
    if (!this.deps) {
      throw new ProviderError('LM Studio dependencies not available', 'DEPS_NOT_CONFIGURED');
    }

    // Bridge LM Studio callbacks to unified stream events
    await model.act(chat, this.deps.toolsRegistry.getLMStudioTools(), {
      signal,
      
      onRoundStart: (index) => {
        queue.push({ type: 'round_start', index });
      },
      
      onRoundEnd: (index) => {
        queue.push({ type: 'round_end', index });
      },
      
      onPredictionFragment: (text) => {
        queue.push({ type: 'text', value: text });
      },
      
      onPredictionCompleted: () => {
        // No-op; we emit 'end' at function end
      },
      
      onToolCallRequestStart: (_round, callId) => {
        toolArgBuffers.set(callId, { args: [] });
      },
      
      onToolCallRequestNameReceived: (_round, callId, name) => {
        const buf = toolArgBuffers.get(callId) ?? { args: [] };
        buf.name = name;
        toolArgBuffers.set(callId, buf);
      },
      
      onToolCallRequestArgumentFragmentGenerated: (_round, callId, fragment) => {
        const buf = toolArgBuffers.get(callId) ?? { args: [] };
        buf.args.push(fragment);
        toolArgBuffers.set(callId, buf);
      },
      
      onToolCallRequestEnd: (round, callId) => {
        const buf = toolArgBuffers.get(callId);
        const name = buf?.name ?? 'unknown';
        const raw = (buf?.args ?? []).join('');
        
        let parsed: unknown;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = raw;
        }
        
        queue.push({
          type: 'tool_call',
          toolName: name,
          arguments: parsed,
          callId
        });
        
        // Clean up buffer
        toolArgBuffers.delete(callId);
      },
      
      onMessage: (msg) => {
        // Optional: could emit assistant/user message boundaries if needed
      },
      
      guardToolCall: async (round, callId, controller) => {
        try {
          const decision = await guardPolicy({
            id: controller.toolCallRequest.id,
            name: controller.toolCallRequest.name,
            args: controller.toolCallRequest.arguments,
            round
          });
          
          if (decision === 'approved') {
            controller.allow();
          } else {
            controller.deny('Denied by guard policy');
          }
        } catch (error) {
          controller.deny(`Guard policy error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
  }

  /**
   * Default guard policy: auto-approve safe tools, require explicit approval for others
   */
  private defaultGuardPolicy = async (info: ToolCallInfo): Promise<'approved' | 'denied'> => {
    // Safe tools that can be auto-approved
    const SAFE_TOOLS = new Set(['GraphQuery', 'Read', 'search', 'calculator']);
    
    return SAFE_TOOLS.has(info.name) ? 'approved' : 'denied';
  };

  /**
   * Estimate token count for LM Studio (depends on loaded model)
   */
  protected estimateTokenCount(opts: ChatOptions): number {
    // Use a generic estimation since we don't know the specific tokenizer
    const messageText = opts.messages.map(m => m.content).join(' ');
    const baseTokens = Math.ceil(messageText.length / 4);
    
    // Add overhead for message structure
    const messageOverhead = opts.messages.length * 2;
    
    // Add tool schema overhead
    const toolOverhead = opts.tools ? opts.tools.length * 10 : 0;
    
    return baseTokens + messageOverhead + toolOverhead;
  }
}

/**
 * Factory function for creating LM Studio adapter with dependencies
 */
export function createLMStudioAdapter(deps: LMStudioDeps, config: Omit<LMStudioConfig, 'deps'> = {}): LMStudioAdapter {
  return new LMStudioAdapter({ ...config, deps });
}

/**
 * Helper to check if LM Studio dependencies are available
 */
export function isLMStudioAvailable(deps?: LMStudioDeps): boolean {
  return !!(deps && 
    typeof deps.getSelectedModel === 'function' && 
    typeof deps.createChatSession === 'function' && 
    deps.toolsRegistry && 
    typeof deps.toolsRegistry.getLMStudioTools === 'function');
}