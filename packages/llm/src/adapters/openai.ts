// src/adapters/openai.ts
// OpenAI adapter with streaming and tool calling support

import OpenAI from 'openai';
import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema, ModelInfo } from '../types.js';
import { BaseAdapter, type ProviderConfig, ProviderError, AuthenticationError, ModelNotFoundError } from './base.js';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  organization?: string;
  project?: string;
  baseURL?: string;
}

/**
 * OpenAI adapter implementation
 */
export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    super('openai', config);
    
    if (!config.apiKey) {
      throw new AuthenticationError('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      project: config.project,
      baseURL: config.baseURL
    });
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);

    try {
      const stream = await this.client.chat.completions.create({
        model: opts.model,
        messages: this.convertMessages(opts.messages),
        stream: true,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        tools: opts.tools ? this.convertTools(opts.tools) : undefined,
        tool_choice: opts.tools ? 'auto' : undefined
      }, {
        signal: opts.signal
      });

      yield* this.processStreamingResponse(stream);
    } catch (error) {
      this.handleError(error);
    }
  }

  async models(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.models.list();
      
      return response.data
        .filter(model => model.id.startsWith('gpt-')) // Filter to chat models
        .map(model => ({
          id: model.id,
          name: model.id,
          description: `OpenAI ${model.id}`,
          supportsStreaming: true,
          supportsToolCalls: model.id.includes('gpt-4') || model.id.includes('gpt-3.5'),
          contextWindow: this.getContextWindow(model.id),
          maxTokens: this.getMaxTokens(model.id)
        }));
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Convert Sage messages to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id || '' // Ensure tool_call_id is a string
        };
      }
      
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      };
    });
  }

  /**
   * Convert Sage tools to OpenAI format
   */
  private convertTools(tools: ToolSchema[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Process streaming response from OpenAI
   */
  private async *processStreamingResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): AsyncIterable<StreamEvent> {
    let toolCalls = new Map<number, { id?: string; name?: string; args: string }>();

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const { delta, finish_reason } = choice;

      // Handle text content
      if (delta.content) {
        yield { type: 'text', value: delta.content };
      }

      // Handle tool calls
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          let current = toolCalls.get(index) || { args: '' };

          // Update tool call data
          if (toolCall.id) {
            current.id = toolCall.id;
          }
          
          if (toolCall.function?.name) {
            current.name = toolCall.function.name;
          }
          
          if (toolCall.function?.arguments) {
            current.args += toolCall.function.arguments;
          }

          toolCalls.set(index, current);

          // If we have all the data, emit the tool call
          if (current.id && current.name && finish_reason) {
            let parsedArgs: unknown;
            try {
              parsedArgs = current.args ? JSON.parse(current.args) : {};
            } catch {
              parsedArgs = current.args;
            }

            yield {
              type: 'tool_call',
              toolName: current.name,
              arguments: parsedArgs,
              callId: current.id
            };
            
            // Clean up completed tool call
            toolCalls.delete(index);
          }
        }
      }

      // Handle completion
      if (finish_reason) {
        if (chunk.usage) {
          yield {
            type: 'end',
            usage: {
              prompt: chunk.usage.prompt_tokens,
              completion: chunk.usage.completion_tokens
            }
          };
        } else {
          yield { type: 'end' };
        }
      }
    }
  }

  /**
   * Get context window for model
   */
  private getContextWindow(modelId: string): number {
    if (modelId.includes('gpt-4-turbo')) return 128000;
    if (modelId.includes('gpt-4')) return 8192;
    if (modelId.includes('gpt-3.5-turbo-16k')) return 16384;
    if (modelId.includes('gpt-3.5')) return 4096;
    return 4096; // Default
  }

  /**
   * Get max tokens for model
   */
  private getMaxTokens(modelId: string): number {
    if (modelId.includes('gpt-4-turbo')) return 4096;
    if (modelId.includes('gpt-4')) return 4096;
    if (modelId.includes('gpt-3.5')) return 4096;
    return 4096; // Default
  }

  /**
   * Estimate token count (more accurate for OpenAI)
   */
  protected estimateTokenCount(opts: ChatOptions): number {
    // Rough estimation based on OpenAI's tokenization
    const messageText = opts.messages.map(m => m.content).join(' ');
    const baseTokens = Math.ceil(messageText.length / 4);
    
    // Add overhead for message structure
    const messageOverhead = opts.messages.length * 3;
    
    // Add tool schema overhead
    const toolOverhead = opts.tools ? opts.tools.length * 20 : 0;
    
    return baseTokens + messageOverhead + toolOverhead;
  }
}