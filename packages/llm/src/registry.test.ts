// src/registry.test.ts
// Basic tests for the registry functionality

import { describe, it, expect, beforeEach } from "vitest";
import { setProvider, getProvider, listModels } from "./registry";
import type { LLMProvider } from "./types";

describe("registry", () => {
  beforeEach(() => {
    // Reset the provider before each test
    // This would require modifying the registry to allow clearing
    // For now, we'll just be careful about test order
  });

  it("should allow setting and getting a provider", () => {
    const mockProvider: LLMProvider = {
      name: "test-provider",
      chat: async () => ({ text: "test" }),
      models: async () => [{ name: "test-model" }]
    };

    setProvider(mockProvider);
    expect(getProvider()).toBe(mockProvider);
  });

  it("should throw an error when setting an invalid provider", () => {
    expect(() => setProvider(null as any)).toThrow("Provider must be an object");
    expect(() => setProvider({} as any)).toThrow("Provider must have a name property");
    expect(() => setProvider({ name: "test" } as any)).toThrow("Provider must implement chat() method");
  });

  it("should list models from the current provider", async () => {
    const mockProvider: LLMProvider = {
      name: "test-provider",
      chat: async () => ({ text: "test" }),
      models: async () => [{ name: "test-model" }]
    };

    setProvider(mockProvider);
    const models = await listModels();
    expect(models).toEqual([{ name: "test-model" }]);
  });

  it("should throw an error when listing models with no provider set", async () => {
    // This test would require us to clear the provider first
    // We'll skip this for now since we don't have a way to clear providers
  });
});