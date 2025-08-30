// src/adapters/lmstudio-factory.ts
// Simplified factory for creating LM Studio adapters

import { LMStudioAdapter } from './lmstudio.js';
import type { LMStudioDeps } from './lmstudio.js';
import type { ProviderConfig } from './base.js';

/**
 * Create an LM Studio adapter with simplified configuration
 * 
 * @param deps - LM Studio dependencies
 * @param config - Additional provider configuration
 * @returns LMStudioAdapter instance
 * 
 * @example
 * ```typescript
 * import { createLMStudioAdapter } from '@sage/llm/adapters/lmstudio-factory';
 * import { setProvider } from '@sage/llm';
 * 
 * // Assuming you have LM Studio dependencies available
 * const adapter = createLMStudioAdapter(lmStudioDeps);
 * setProvider(adapter);
 * ```
 */
export function createLMStudioAdapter(deps: LMStudioDeps, config: ProviderConfig = {}): LMStudioAdapter {
  return new LMStudioAdapter({ ...config, deps });
}

/**
 * Create an LM Studio adapter with a more opinionated setup
 * 
 * @param deps - LM Studio dependencies
 * @param modelName - Name of the model to use (for display purposes)
 * @param config - Additional provider configuration
 * @returns LMStudioAdapter instance
 * 
 * @example
 * ```typescript
 * import { createDefaultLMStudioAdapter } from '@sage/llm/adapters/lmstudio-factory';
 * import { setProvider } from '@sage/llm';
 * 
 * const adapter = createDefaultLMStudioAdapter(lmStudioDeps, 'llama3');
 * setProvider(adapter);
 * ```
 */
export function createDefaultLMStudioAdapter(
  deps: LMStudioDeps, 
  modelName: string = 'local-model',
  config: ProviderConfig = {}
): LMStudioAdapter {
  const defaultConfig: ProviderConfig = {
    defaultModel: modelName,
    supportsStreaming: true,
    supportsToolCalls: true,
    maxTokensPerRequest: 8192,
    timeout: 60000, // 60 second timeout for local models
    ...config
  };
  
  return new LMStudioAdapter({ ...defaultConfig, deps });
}