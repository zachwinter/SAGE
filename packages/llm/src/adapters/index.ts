// src/adapters/index.ts
// Adapter exports and registration

export { BaseAdapter, ProviderFactory, AdapterRegistry } from './base.js';
export type { 
  ProviderConfig, 
  ProviderError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError
} from './base.js';

export type { ModelInfo } from '../types.js';

// OpenAI adapter
export { OpenAIAdapter } from './openai.js';
export type { OpenAIConfig } from './openai.js';

// Anthropic adapter
export { AnthropicAdapter } from './anthropic.js';
export type { AnthropicConfig } from './anthropic.js';

// LM Studio adapter
export { LMStudioAdapter, createLMStudioAdapter, isLMStudioAvailable } from './lmstudio.js';
export { createDefaultLMStudioAdapter } from './lmstudio-factory.js';
export type { LMStudioConfig, LMStudioDeps, Chat, LMStudioModel } from './lmstudio.js';

// MCP adapter
export { MCPAdapter } from './mcp.js';
export type { MCPConfig } from './mcp.js';

// Test adapter
export { TestProvider, TestProviderFactory } from './test.js';
export type { TestProviderConfig, TestResponse } from './test.js';

// Register all adapters with the registry
import { AdapterRegistry } from './base.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { LMStudioAdapter } from './lmstudio.js';
import { MCPAdapter } from './mcp.js';
import { TestProvider } from './test.js';

// Register adapters
AdapterRegistry.register(
  'openai',
  'OpenAI GPT models with streaming and tool calling',
  (config) => new OpenAIAdapter(config as any),
  ['apiKey']
);

AdapterRegistry.register(
  'anthropic',
  'Anthropic Claude models with streaming and tool calling',
  (config) => new AnthropicAdapter(config as any),
  ['apiKey']
);

AdapterRegistry.register(
  'lmstudio',
  'LM Studio local models with act-loop bridge',
  (config) => new LMStudioAdapter(config as any),
  [] // deps are optional and can be set later
);

AdapterRegistry.register(
  'mcp',
  'Model Context Protocol integration',
  (config) => new MCPAdapter(config as any),
  []
);

AdapterRegistry.register(
  'test',
  'Test provider for deterministic testing',
  (config) => new TestProvider(config as any),
  []
);

/**
 * Convenience function to create adapters by name
 */
export function createAdapter(name: string, config: any) {
  return AdapterRegistry.create(name, config);
}

/**
 * Get list of available adapters
 */
export function listAdapters() {
  return AdapterRegistry.list();
}