// src/adapters/openai.ts
// OpenAI adapter with streaming and tool calling support

import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema } from '../types.js';
import { BaseAdapter, type ProviderConfig, type ModelInfo, ProviderError, AuthenticationError, ModelNotFoundError } from './base.js';

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
 * OpenAI message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

/**
 * OpenAI tool call format
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI tool format
 */
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * OpenAI streaming response chunk
 */
interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI completion response
 */
interface OpenAICompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI models response
 */
interface OpenAIModelsResponse {
  object: 'list';
  data: Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }>;
}

/**
 * OpenAI adapter implementation
 */
export class OpenAIAdapter extends BaseAdapter {
  private apiKey: string;
  private baseURL: string;
  private organization?: string;
  private project?: string;

  constructor(config: OpenAIConfig) {
    super('openai', config);
    
    if (!config.apiKey) {
      throw new AuthenticationError('OpenAI API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.organization = config.organization;
    this.project = config.project;
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);

    const requestBody = {
      model: opts.model,
      messages: this.convertMessages(opts.messages),
      stream: true,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      tools: opts.tools ? this.convertTools(opts.tools) : undefined,
      tool_choice: opts.tools ? 'auto' : undefined
    };

    const response = await this.makeRequest('/chat/completions', {
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
    const response = await this.makeRequest('/models');
    
    if (!response.ok) {
      await this.handleAPIError(response);
    }

    const data: OpenAIModelsResponse = await response.json();
    
    return data.data
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
  }

  /**
   * Convert Sage messages to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
      content: msg.content,
      tool_call_id: msg.tool_call_id
    }));
  }

  /**
   * Convert Sage tools to OpenAI format
   */
  private convertTools(tools: ToolSchema[]): OpenAITool[] {
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
   * Make HTTP request to OpenAI API
   */
  private async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.config.headers
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    if (this.project) {
      headers['OpenAI-Project'] = this.project;
    }

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
    const code = errorData.error?.code || 'API_ERROR';

    if (response.status === 401) {
      throw new AuthenticationError(message);
    }

    if (response.status === 404 && message.includes('model')) {
      throw new ModelNotFoundError(errorData.error?.param || 'unknown');
    }

    if (response.status === 429) {
      throw new ProviderError(message, 'RATE_LIMIT', response.status);
    }

    throw new ProviderError(message, code, response.status);
  }

  /**
   * Process streaming response from OpenAI
   */
  private async *processStreamingResponse(stream: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let toolCalls = new Map<number, { id?: string; name?: string; args: string }>();

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
            // End of stream
            yield { type: 'end' };
            return;
          }
          
          try {
            const chunk: OpenAIStreamChunk = JSON.parse(data);
            yield* this.processChunk(chunk, toolCalls);
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
   * Process individual chunk from OpenAI stream
   */
  private *processChunk(
    chunk: OpenAIStreamChunk,
    toolCalls: Map<number, { id?: string; name?: string; args: string }>
  ): Generator<StreamEvent> {
    const choice = chunk.choices?.[0];
    if (!choice) return;

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