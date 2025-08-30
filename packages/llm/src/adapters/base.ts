// src/adapters/base.ts
// Base adapter infrastructure for provider implementations

import type { LLMProvider, ChatOptions, StreamEvent, ToolSchema, ModelInfo } from '../types.js';
import { AsyncQueue } from '../stream-utils.js';
import { withEventNormalization, type NormalizationContext } from '../event-normalization.js';

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  // API credentials
  apiKey?: string;
  
  // Base URL override
  baseURL?: string;
  
  // Request timeout in milliseconds
  timeout?: number;
  
  // Custom headers
  headers?: Record<string, string>;
  
  // Model configuration
  defaultModel?: string;
  availableModels?: string[];
  
  // Feature flags
  supportsStreaming?: boolean;
  supportsToolCalls?: boolean;
  supportsImageInput?: boolean;
  
  // Rate limiting
  maxRequestsPerMinute?: number;
  maxTokensPerRequest?: number;
  
  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Provider adapter error types
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends ProviderError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT', 429);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends ProviderError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION', 401);
  }
}

/**
 * Model not found error
 */
export class ModelNotFoundError extends ProviderError {
  constructor(model: string) {
    super(`Model '${model}' not found`, 'MODEL_NOT_FOUND', 404);
  }
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseAdapter implements LLMProvider {
  protected config: Required<ProviderConfig>;

  constructor(
    public readonly name: string,
    config: ProviderConfig = {}
  ) {
    this.config = {
      apiKey: '',
      baseURL: '',
      timeout: 30000,
      headers: {},
      defaultModel: '',
      availableModels: [],
      supportsStreaming: true,
      supportsToolCalls: true,
      supportsImageInput: false,
      maxRequestsPerMinute: 60,
      maxTokensPerRequest: 4096,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Abstract method to implement chat functionality
   */
  abstract chat(opts: ChatOptions): AsyncIterable<StreamEvent>;

  /**
   * Abstract method to get available models
   */
  abstract models(): Promise<ModelInfo[]>;

  /**
   * Validate chat options before processing
   */
  protected validateChatOptions(opts: ChatOptions): void {
    if (!opts.model) {
      throw new ProviderError('Model is required', 'INVALID_REQUEST');
    }

    if (!Array.isArray(opts.messages) || opts.messages.length === 0) {
      throw new ProviderError('Messages array is required and cannot be empty', 'INVALID_REQUEST');
    }

    // Check token limits
    const estimatedTokens = this.estimateTokenCount(opts);
    if (estimatedTokens > this.config.maxTokensPerRequest) {
      throw new ProviderError(
        `Request exceeds maximum token limit (${estimatedTokens} > ${this.config.maxTokensPerRequest})`,
        'TOKEN_LIMIT_EXCEEDED'
      );
    }
  }

  /**
   * Rough token estimation (to be overridden by specific providers)
   */
  protected estimateTokenCount(opts: ChatOptions): number {
    const messageText = opts.messages.map(m => m.content).join(' ');
    return Math.ceil(messageText.length / 4); // Rough approximation
  }

  /**
   * Create a standardized async queue for streaming
   */
  protected createStreamQueue(): AsyncQueue<StreamEvent> {
    return new AsyncQueue<StreamEvent>();
  }

  /**
   * Handle provider-specific errors
   */
  protected handleError(error: unknown): never {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      // Try to extract structured error information
      const message = error.message;
      
      if (message.includes('rate limit')) {
        throw new RateLimitError(message);
      }
      
      if (message.includes('authentication') || message.includes('unauthorized')) {
        throw new AuthenticationError(message);
      }
      
      if (message.includes('model') && message.includes('not found')) {
        const modelMatch = message.match(/model[^a-zA-Z]+([a-zA-Z0-9-_]+)/i);
        const model = modelMatch ? modelMatch[1] : 'unknown';
        throw new ModelNotFoundError(model);
      }

      throw new ProviderError(message, 'UNKNOWN_ERROR', undefined, error);
    }

    throw new ProviderError(
      `Unknown error: ${String(error)}`,
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }

  /**
   * Implement retry logic with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = this.config.maxRetries
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error instanceof AuthenticationError || 
            error instanceof ModelNotFoundError ||
            (error instanceof ProviderError && error.code === 'INVALID_REQUEST')) {
          throw error;
        }
        
        // On final attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff + jitter
        const baseDelay = this.config.retryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Convert tool schemas to provider-specific format
   */
  protected convertToolSchemas(tools?: ToolSchema[]): unknown[] {
    if (!tools) return [];
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Generate a unique request ID
   */
  protected generateRequestId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Provider factory for creating and managing adapters
 */
export class ProviderFactory {
  private static adapters = new Map<string, () => BaseAdapter>();
  private static instances = new Map<string, BaseAdapter>();

  /**
   * Register an adapter factory function
   */
  static register(name: string, factory: () => BaseAdapter): void {
    this.adapters.set(name, factory);
  }

  /**
   * Create or get an adapter instance
   */
  static get(name: string): BaseAdapter | undefined {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const factory = this.adapters.get(name);
    if (!factory) {
      return undefined;
    }

    const adapter = factory();
    this.instances.set(name, adapter);
    return adapter;
  }

  /**
   * List all registered adapter names
   */
  static list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Clear all instances (useful for testing)
   */
  static clear(): void {
    this.instances.clear();
  }

  /**
   * Create adapter with configuration
   */
  static create(name: string, config: ProviderConfig): BaseAdapter {
    const factory = this.adapters.get(name);
    if (!factory) {
      throw new Error(`Unknown provider: ${name}`);
    }

    return factory();
  }
}

/**
 * Adapter registry for auto-discovery
 */
export class AdapterRegistry {
  private static registry = new Map<string, {
    name: string;
    description: string;
    factory: (config: ProviderConfig) => BaseAdapter;
    requiredConfig: (keyof ProviderConfig)[];
  }>();

  /**
   * Register an adapter
   */
  static register(
    name: string,
    description: string,
    factory: (config: ProviderConfig) => BaseAdapter,
    requiredConfig: (keyof ProviderConfig)[] = []
  ): void {
    this.registry.set(name, {
      name,
      description,
      factory,
      requiredConfig
    });
  }

  /**
   * Create adapter with validation
   */
  static create(name: string, config: ProviderConfig): BaseAdapter {
    const registration = this.registry.get(name);
    if (!registration) {
      throw new Error(`Unknown adapter: ${name}`);
    }

    // Validate required configuration
    for (const key of registration.requiredConfig) {
      if (!config[key]) {
        throw new Error(`Missing required configuration: ${String(key)}`);
      }
    }

    return registration.factory(config);
  }

  /**
   * List all registered adapters
   */
  static list(): Array<{
    name: string;
    description: string;
    requiredConfig: string[];
  }> {
    return Array.from(this.registry.values()).map(({ name, description, requiredConfig }) => ({
      name,
      description,
      requiredConfig: requiredConfig.map(String)
    }));
  }

  /**
   * Get adapter info
   */
  static getInfo(name: string) {
    return this.registry.get(name);
  }
}