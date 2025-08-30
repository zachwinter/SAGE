// src/adapters/test.ts
// Test/Fake provider for deterministic testing

import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema, ModelInfo } from '../types.js';
import { BaseAdapter, type ProviderConfig } from './base.js';
import { AsyncQueue } from '../stream-utils.js';

/**
 * Test provider configuration
 */
export interface TestProviderConfig extends Omit<ProviderConfig, 'availableModels'> {
  // Predefined responses
  responses?: TestResponse[];
  
  // Default response if no specific response is configured
  defaultResponse?: string;
  
  // Simulate delays (in milliseconds)
  responseDelay?: number;
  chunkDelay?: number;
  
  // Error simulation
  shouldError?: boolean;
  errorMessage?: string;
  errorAfterChunks?: number;
  
  // Tool call simulation
  simulateToolCalls?: boolean;
  toolCallResponses?: Record<string, unknown>;
  
  // Model simulation
  availableModels?: ModelInfo[];
  
  // Usage tracking
  trackUsage?: boolean;
}

/**
 * Test response configuration
 */
export interface TestResponse {
  // Trigger conditions
  model?: string;
  messagePattern?: RegExp;
  messageContains?: string;
  
  // Response configuration
  text?: string;
  chunks?: string[];
  toolCalls?: Array<{
    name: string;
    arguments: unknown;
    result?: unknown;
  }>;
  
  // Streaming configuration
  streamDelay?: number;
  
  // Error configuration
  shouldError?: boolean;
  errorMessage?: string;
  
  // Usage simulation
  usage?: {
    prompt: number;
    completion: number;
  };
}

/**
 * Test provider for deterministic testing
 */
export class TestProvider extends BaseAdapter {
  private responses: TestResponse[];
  private defaultResponse: string;
  private responseDelay: number;
  private chunkDelay: number;
  private shouldError: boolean;
  private errorMessage: string;
  private errorAfterChunks: number;
  private simulateToolCalls: boolean;
  private toolCallResponses: Record<string, unknown>;
  private availableModels: ModelInfo[];
  private trackUsage: boolean;
  
  // Usage tracking
  private requestCount = 0;
  private tokenUsage = { prompt: 0, completion: 0 };

  constructor(config: TestProviderConfig = {}) {
    // Extract the base config properties
    const { responses, defaultResponse, responseDelay, chunkDelay, shouldError, 
            errorMessage, errorAfterChunks, simulateToolCalls, toolCallResponses, 
            availableModels, trackUsage, ...baseConfig } = config;
    
    super('test', baseConfig);
    
    this.responses = config.responses || [];
    this.defaultResponse = config.defaultResponse || 'Test response';
    this.responseDelay = config.responseDelay || 0;
    this.chunkDelay = config.chunkDelay || 10;
    this.shouldError = config.shouldError || false;
    this.errorMessage = config.errorMessage || 'Test error';
    this.errorAfterChunks = config.errorAfterChunks || 0;
    this.simulateToolCalls = config.simulateToolCalls || false;
    this.toolCallResponses = config.toolCallResponses || {};
    this.trackUsage = config.trackUsage || false;
    
    this.availableModels = config.availableModels || [
      {
        id: 'test-model',
        name: 'Test Model',
        description: 'A test model for deterministic testing',
        contextWindow: 4096,
        maxTokens: 1024,
        supportsStreaming: true,
        supportsToolCalls: true
      },
      {
        id: 'test-model-large',
        name: 'Test Model Large',
        description: 'A larger test model',
        contextWindow: 8192,
        maxTokens: 2048,
        supportsStreaming: true,
        supportsToolCalls: true
      }
    ];
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);
    
    this.requestCount++;
    
    // Add initial delay if configured
    if (this.responseDelay > 0) {
      await this.delay(this.responseDelay);
    }
    
    // Find matching response configuration
    const response = this.findMatchingResponse(opts);
    
    // Check for error simulation
    if (response.shouldError || this.shouldError) {
      throw new Error(response.errorMessage || this.errorMessage);
    }
    
    // Generate response chunks
    const chunks = this.generateResponseChunks(response, opts);
    
    // Stream the response
    yield* this.streamResponse(chunks, response);
  }

  async models(): Promise<ModelInfo[]> {
    if (this.shouldError) {
      throw new Error(this.errorMessage);
    }
    
    return [...this.availableModels];
  }

  /**
   * Configure responses dynamically
   */
  setResponses(responses: TestResponse[]): void {
    this.responses = responses;
  }

  /**
   * Add a response configuration
   */
  addResponse(response: TestResponse): void {
    this.responses.push(response);
  }

  /**
   * Clear all response configurations
   */
  clearResponses(): void {
    this.responses = [];
  }

  /**
   * Configure error simulation
   */
  setError(shouldError: boolean, message = 'Test error'): void {
    this.shouldError = shouldError;
    this.errorMessage = message;
  }

  /**
   * Get usage statistics
   */
  getUsage(): { requests: number; tokens: { prompt: number; completion: number } } {
    return {
      requests: this.requestCount,
      tokens: { ...this.tokenUsage }
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.requestCount = 0;
    this.tokenUsage = { prompt: 0, completion: 0 };
  }

  /**
   * Set available models
   */
  setModels(models: ModelInfo[]): void {
    this.availableModels = models;
  }

  /**
   * Find matching response for request
   */
  private findMatchingResponse(opts: ChatOptions): TestResponse {
    for (const response of this.responses) {
      // Check model match
      if (response.model && response.model !== opts.model) {
        continue;
      }
      
      // Check message pattern match
      if (response.messagePattern) {
        const lastMessage = opts.messages[opts.messages.length - 1];
        if (!response.messagePattern.test(lastMessage?.content || '')) {
          continue;
        }
      }
      
      // Check message contains
      if (response.messageContains) {
        const lastMessage = opts.messages[opts.messages.length - 1];
        if (!lastMessage?.content.includes(response.messageContains)) {
          continue;
        }
      }
      
      return response;
    }
    
    // Return default response
    return {
      text: this.defaultResponse,
      usage: { prompt: 10, completion: 5 }
    };
  }

  /**
   * Generate response chunks from configuration
   */
  private generateResponseChunks(response: TestResponse, opts: ChatOptions): Array<StreamEvent> {
    const events: StreamEvent[] = [];
    
    // Add tool calls first if configured
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const callId = this.generateCallId();
        
        events.push({
          type: 'tool_call',
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          callId
        });
        
        if (toolCall.result !== undefined) {
          events.push({
            type: 'tool_result',
            callId,
            result: toolCall.result
          });
        }
      }
    }
    
    // Add text response
    if (response.chunks) {
      // Use predefined chunks
      for (const chunk of response.chunks) {
        events.push({ type: 'text', value: chunk });
      }
    } else if (response.text) {
      // For simple responses, just emit as single chunk to match test expectations
      events.push({ type: 'text', value: response.text });
    }
    
    // Add end event with usage
    events.push({
      type: 'end',
      usage: response.usage || { prompt: 10, completion: 5 }
    });
    
    return events;
  }

  /**
   * Stream the response events
   */
  private async *streamResponse(events: StreamEvent[], response: TestResponse): AsyncIterable<StreamEvent> {
    const delay = response.streamDelay || this.chunkDelay;
    
    for (let i = 0; i < events.length; i++) {
      // Check for error after chunks
      if (this.errorAfterChunks > 0 && i >= this.errorAfterChunks) {
        throw new Error(this.errorMessage);
      }
      
      if (delay > 0 && i > 0) {
        await this.delay(delay);
      }
      
      const event = events[i];
      yield event;
      
      // Track usage
      if (this.trackUsage && event.type === 'end' && event.usage) {
        this.tokenUsage.prompt += event.usage.prompt;
        this.tokenUsage.completion += event.usage.completion;
      }
    }
  }

  /**
   * Generate a unique call ID
   */
  private generateCallId(): string {
    return `test_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory functions for common test scenarios
 */
export class TestProviderFactory {
  /**
   * Create provider that returns simple text
   */
  static simple(text = 'Hello, world!'): TestProvider {
    return new TestProvider({
      defaultResponse: text,
      trackUsage: true
    });
  }

  /**
   * Create provider that simulates streaming
   */
  static streaming(text = 'This is a streaming response', chunkDelay = 50): TestProvider {
    // Split text into chunks for streaming effect
    const chunkSize = 8;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    
    return new TestProvider({
      responses: [{
        chunks
      }],
      chunkDelay,
      trackUsage: true
    });
  }

  /**
   * Create provider that simulates tool calls
   */
  static withTools(toolCalls: TestResponse['toolCalls'] = []): TestProvider {
    return new TestProvider({
      responses: [{
        text: 'I need to use some tools.',
        toolCalls
      }],
      simulateToolCalls: true,
      trackUsage: true
    });
  }

  /**
   * Create provider that throws errors
   */
  static error(message = 'Test error'): TestProvider {
    return new TestProvider({
      shouldError: true,
      errorMessage: message
    });
  }

  /**
   * Create provider with custom responses
   */
  static withResponses(responses: TestResponse[]): TestProvider {
    return new TestProvider({
      responses,
      trackUsage: true
    });
  }

  /**
   * Create provider that simulates slow responses
   */
  static slow(delay = 1000, text = 'Slow response'): TestProvider {
    return new TestProvider({
      defaultResponse: text,
      responseDelay: delay,
      trackUsage: true
    });
  }
}