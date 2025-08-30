// src/adapters/anthropic.ts
// Anthropic Claude adapter with streaming and tool calling support

import Anthropic from '@anthropic-ai/sdk';
import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema, ModelInfo } from '../types.js';
import { BaseAdapter, type ProviderConfig, ProviderError, AuthenticationError, ModelNotFoundError } from './base.js';

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends ProviderConfig {
  apiKey: string;
  baseURL?: string;
  version?: string;
}

/**
 * Anthropic adapter implementation
 */
export class AnthropicAdapter extends BaseAdapter {
  private client: Anthropic;

  constructor(config: AnthropicConfig) {
    super('anthropic', config);
    
    if (!config.apiKey) {
      throw new AuthenticationError('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: {
        'anthropic-dangerous-direct-browser-access': 'true', // For browser usage
        ...config.headers
      }
    });
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);

    try {
      // Convert messages to Anthropic format
      const { messages, system } = this.convertMessages(opts.messages);

      const stream = this.client.messages.stream({
        model: opts.model,
        max_tokens: opts.max_tokens || 4096,
        messages,
        system,
        temperature: opts.temperature,
        tools: opts.tools ? this.convertTools(opts.tools) : undefined
      }, {
        signal: opts.signal
      });

      yield* this.processStreamingResponse(stream);
    } catch (error) {
      this.handleError(error);
    }
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
  private convertMessages(messages: ChatMessage[]): { messages: Anthropic.MessageParam[]; system?: string } {
    let system: string | undefined;
    const convertedMessages: Anthropic.MessageParam[] = [];

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
              tool_use_id: msg.tool_call_id || '',
              content: msg.content
            });
          } else {
            // Convert to array format
            lastMessage.content = [
              { type: 'text', text: lastMessage.content as string },
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id || '',
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
              tool_use_id: msg.tool_call_id || '',
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
  private convertTools(tools: ToolSchema[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: (tool.parameters.required as string[]) || []
      }
    }));
  }

  /**
   * Process streaming response from Anthropic
   */
  private async *processStreamingResponse(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): AsyncIterable<StreamEvent> {
    let toolUses = new Map<string, { name: string; input: string }>();

    for await (const event of stream) {
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
            const toolId = event.index.toString();
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
              
              // Clean up completed tool use
              toolUses.delete(completedToolId);
            }
          }
          break;

        case 'message_delta':
          if (event.delta.stop_reason) {
            yield {
              type: 'end',
              usage: event.usage ? {
                prompt: event.usage.input_tokens || 0,
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