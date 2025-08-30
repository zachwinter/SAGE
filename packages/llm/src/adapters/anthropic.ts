// src/adapters/anthropic.ts
// Anthropic Claude adapter with streaming and tool calling support

import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema } from '../types.js';
import { BaseAdapter, type ProviderConfig, type ModelInfo, ProviderError, AuthenticationError, ModelNotFoundError } from './base.js';

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  version?: string;
}

/**
 * Anthropic message format
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

/**
 * Anthropic content format (for complex messages)
 */
type AnthropicContent = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };

/**
 * Anthropic tool format
 */
interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

/**
 * Anthropic streaming event
 */
type AnthropicStreamEvent = 
  | { type: 'message_start'; message: { id: string; type: 'message'; role: 'assistant'; content: []; model: string; stop_reason: null; stop_sequence: null; usage: { input_tokens: number; output_tokens: number } } }
  | { type: 'content_block_start'; index: number; content_block: { type: 'text'; text: '' } | { type: 'tool_use'; id: string; name: string; input: {} } }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string; stop_sequence: null }; usage: { output_tokens: number } }
  | { type: 'message_stop' };

/**
 * Anthropic completion response
 */
interface AnthropicCompletion {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  } | {
    type: 'tool_use';
    id: string;
    name: string;
    input: unknown;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic adapter implementation
 */
export class AnthropicAdapter extends BaseAdapter {
  private apiKey: string;
  private baseURL: string;
  private version: string;

  constructor(config: AnthropicConfig) {
    super('anthropic', config);
    
    if (!config.apiKey) {
      throw new AuthenticationError('Anthropic API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.version = config.version || '2023-06-01';
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);

    // Convert messages to Anthropic format
    const { messages, system } = this.convertMessages(opts.messages);

    const requestBody = {
      model: opts.model,
      max_tokens: opts.max_tokens || 4096,
      messages,
      stream: true,
      system,
      temperature: opts.temperature,
      tools: opts.tools ? this.convertTools(opts.tools) : undefined
    };

    const response = await this.makeRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal: opts.signal
    });

    if (!response.ok) {
      await this.handleAPIError(response);
    }

    if (!response.body) {
      throw new ProviderError('No response body received', 'NO_RESPONSE_BODY');
    }

    yield* this.processStreamingResponse(response.body);
  }

  async models(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models endpoint, so we return known models
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most capable model, ideal for complex tasks',
        contextWindow: 200000,
        maxTokens: 8192,
        supportsStreaming: true,
        supportsToolCalls: true,
        pricing: { inputTokens: 3.00, outputTokens: 15.00 }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model, great for simple tasks',
        contextWindow: 200000,
        maxTokens: 8192,
        supportsStreaming: true,
        supportsToolCalls: true,
        pricing: { inputTokens: 0.25, outputTokens: 1.25 }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for highly complex tasks',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsStreaming: true,
        supportsToolCalls: true,
        pricing: { inputTokens: 15.00, outputTokens: 75.00 }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced model for most tasks',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsStreaming: true,
        supportsToolCalls: true,
        pricing: { inputTokens: 3.00, outputTokens: 15.00 }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast model for simple tasks',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsStreaming: true,
        supportsToolCalls: true,
        pricing: { inputTokens: 0.25, outputTokens: 1.25 }
      }
    ];
  }

  /**
   * Convert Sage messages to Anthropic format
   */
  private convertMessages(messages: ChatMessage[]): { messages: AnthropicMessage[]; system?: string } {
    let system: string | undefined;
    const convertedMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic uses a separate system parameter
        system = msg.content;
      } else if (msg.role === 'tool') {
        // Handle tool results
        const lastMessage = convertedMessages[convertedMessages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          // Append to last user message as tool result
          if (Array.isArray(lastMessage.content)) {
            lastMessage.content.push({
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: msg.content
            });
          } else {
            // Convert to array format
            lastMessage.content = [
              { type: 'text', text: lastMessage.content },
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id!,
                content: msg.content
              }
            ];
          }
        } else {
          // Create new user message with tool result
          convertedMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: msg.content
            }]
          });
        }
      } else {
        convertedMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    return { messages: convertedMessages, system };
  }

  /**
   * Convert Sage tools to Anthropic format
   */
  private convertTools(tools: ToolSchema[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  /**
   * Make HTTP request to Anthropic API
   */
  private async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.version,
      'anthropic-dangerous-direct-browser-access': 'true', // For browser usage
      ...this.config.headers
    };

    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      },
      signal: options.signal
    });
  }

  /**
   * Handle API errors
   */
  private async handleAPIError(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      throw new ProviderError(
        `HTTP ${response.status}: ${response.statusText}`,
        'HTTP_ERROR',
        response.status
      );
    }

    const message = errorData.error?.message || `HTTP ${response.status}`;
    const code = errorData.error?.type || 'API_ERROR';

    if (response.status === 401) {
      throw new AuthenticationError(message);
    }

    if (response.status === 404) {
      throw new ModelNotFoundError(errorData.error?.param || 'unknown');
    }

    if (response.status === 429) {
      throw new ProviderError(message, 'RATE_LIMIT', response.status);
    }

    throw new ProviderError(message, code, response.status);
  }

  /**
   * Process streaming response from Anthropic
   */
  private async *processStreamingResponse(stream: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let toolUses = new Map<string, { name: string; input: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }
          
          const data = trimmed.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            continue;
          }
          
          try {
            const event: AnthropicStreamEvent = JSON.parse(data);
            yield* this.processStreamEvent(event, toolUses);
          } catch (error) {
            console.warn('Failed to parse streaming chunk:', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process individual stream event from Anthropic
   */
  private *processStreamEvent(
    event: AnthropicStreamEvent,
    toolUses: Map<string, { name: string; input: string }>
  ): Generator<StreamEvent> {
    switch (event.type) {
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          toolUses.set(event.content_block.id, {
            name: event.content_block.name,
            input: ''
          });
        }
        break;

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', value: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate tool input JSON
          const toolId = Array.from(toolUses.keys())[event.index] || '';
          const toolUse = toolUses.get(toolId);
          if (toolUse) {
            toolUse.input += event.delta.partial_json;
          }
        }
        break;

      case 'content_block_stop':
        // Check if we completed a tool use
        const completedToolId = Array.from(toolUses.keys())[event.index];
        if (completedToolId) {
          const toolUse = toolUses.get(completedToolId);
          if (toolUse) {
            let parsedInput: unknown;
            try {
              parsedInput = toolUse.input ? JSON.parse(toolUse.input) : {};
            } catch {
              parsedInput = toolUse.input;
            }

            yield {
              type: 'tool_call',
              toolName: toolUse.name,
              arguments: parsedInput,
              callId: completedToolId
            };
          }
        }
        break;

      case 'message_delta':
        if (event.delta.stop_reason) {
          yield {
            type: 'end',
            usage: event.usage ? {
              prompt: 0, // Not provided in delta
              completion: event.usage.output_tokens
            } : undefined
          };
        }
        break;

      case 'message_stop':
        yield { type: 'end' };
        break;

      case 'message_start':
        // Could emit usage info if needed
        break;

      default:
        // Handle unknown event types gracefully
        break;
    }
  }

  /**
   * Estimate token count (more accurate for Anthropic)
   */
  protected estimateTokenCount(opts: ChatOptions): number {
    // Anthropic's Claude models use a different tokenization
    const messageText = opts.messages.map(m => m.content).join(' ');
    const baseTokens = Math.ceil(messageText.length / 3.5); // Claude tends to be more token-efficient
    
    // Add overhead for message structure
    const messageOverhead = opts.messages.length * 2;
    
    // Add tool schema overhead
    const toolOverhead = opts.tools ? opts.tools.length * 15 : 0;
    
    return baseTokens + messageOverhead + toolOverhead;
  }
}