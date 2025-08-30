// src/registry.ts
// Provider registry and management for @sage/llm

import type { LLMProvider } from "./types.js";

// Global provider registry
let currentProvider: LLMProvider | null = null;

/**
 * Set the current LLM provider
 * @param provider The provider to set as current
 */
export function setProvider(provider: LLMProvider): void {
  // Validate provider implements required interface
  if (!provider || typeof provider !== 'object') {
    throw new Error("Provider must be an object");
  }
  
  if (!provider.name || typeof provider.name !== 'string') {
    throw new Error("Provider must have a name property");
  }
  
  if (typeof provider.chat !== 'function') {
    throw new Error("Provider must implement chat() method");
  }
  
  if (typeof provider.models !== 'function') {
    throw new Error("Provider must implement models() method");
  }
  
  currentProvider = provider;
}

/**
 * Get the current LLM provider
 * @returns The current provider or null if none is set
 */
export function getProvider(): LLMProvider | null {
  return currentProvider;
}

/**
 * List available models from a provider or the current provider
 * @param providerName Optional provider name to list models from
 * @returns Promise resolving to array of model info
 */
export async function listModels(providerName?: string): Promise<{ name: string }[]> {
  // If provider name is specified, we would look it up from a registry
  // For now, we'll just use the current provider
  if (!currentProvider) {
    throw new Error("No LLM provider configured");
  }
  
  return await currentProvider.models();
}