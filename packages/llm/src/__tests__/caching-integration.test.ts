// src/__tests__/caching-integration.test.ts
// Integration tests for caching with the main API

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createChatStream, getCacheMetrics, clearCache, getCacheSize } from "../api.js";
import { setProvider } from "../registry.js";
import { TestProvider } from "../adapters/test.js";
import type { ChatOptions, StreamEvent } from "../types.js";

describe("Caching Integration", () => {
  let testProvider: TestProvider;

  beforeEach(async () => {
    testProvider = new TestProvider({
      defaultResponse: "Hello from provider!"
    });
    setProvider(testProvider);
    await clearCache(); // Start with clean cache
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cache modes", () => {
    it("should bypass cache when mode is bypass", async () => {
      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "bypass" }
      };

      // Make two identical requests
      const stream1 = await createChatStream(chatOptions);
      const events1 = [];
      for await (const event of stream1) {
        events1.push(event);
      }

      const stream2 = await createChatStream(chatOptions);
      const events2 = [];
      for await (const event of stream2) {
        events2.push(event);
      }

      // Cache should have no entries
      expect(await getCacheSize()).toBe(0);
      
      // Both requests should have gone to provider
      expect(testProvider.getUsage().requests).toBe(2);

      // Events should be the same (same provider response)
      expect(events1).toEqual(events2);
    });

    it("should use read-through cache", async () => {
      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "read-through" }
      };

      const metrics = getCacheMetrics();
      const initialMisses = metrics.misses;

      // First request - should be cache miss
      const stream1 = await createChatStream(chatOptions);
      const events1 = [];
      for await (const event of stream1) {
        events1.push(event);
      }

      expect(metrics.misses).toBe(initialMisses + 1);
      expect(await getCacheSize()).toBe(1);
      expect(testProvider.getUsage().requests).toBe(1);

      // Second request - should be cache hit
      const stream2 = await createChatStream(chatOptions);
      const events2 = [];
      for await (const event of stream2) {
        events2.push(event);
      }

      expect(metrics.hits).toBe(1);
      expect(await getCacheSize()).toBe(1);
      expect(testProvider.getUsage().requests).toBe(1); // Still only 1 call

      // Events should be identical
      expect(events1).toEqual(events2);
    });

    it("should use record-only cache", async () => {
      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "record-only" }
      };

      // First request
      const stream1 = await createChatStream(chatOptions);
      const events1 = [];
      for await (const event of stream1) {
        events1.push(event);
      }

      expect(await getCacheSize()).toBe(1); // Should store
      expect(testProvider.getUsage().requests).toBe(1);

      // Second request - should still call provider (no read)
      const stream2 = await createChatStream(chatOptions);
      const events2 = [];
      for await (const event of stream2) {
        events2.push(event);
      }

      expect(await getCacheSize()).toBe(1); // Should update the same entry
      expect(testProvider.getUsage().requests).toBe(2); // Should call provider again

      // Events should be the same (same provider response)
      expect(events1).toEqual(events2);
    });
  });

  describe("cache key sensitivity", () => {
    it("should cache differently for different models", async () => {
      const baseOptions = {
        messages: [{ role: "user" as const, content: "test" }],
        cache: { mode: "read-through" as const }
      };

      // Request with model A
      const stream1 = await createChatStream({ ...baseOptions, model: "model-a" });
      for await (const event of stream1) { /* consume */ }

      // Request with model B  
      const stream2 = await createChatStream({ ...baseOptions, model: "model-b" });
      for await (const event of stream2) { /* consume */ }

      expect(await getCacheSize()).toBe(2); // Different cache entries
      expect(testProvider.getUsage().requests).toBe(2); // Two provider calls
    });

    it("should cache differently for different messages", async () => {
      const baseOptions = {
        model: "test-model",
        cache: { mode: "read-through" as const }
      };

      const stream1 = await createChatStream({
        ...baseOptions,
        messages: [{ role: "user", content: "Hello" }]
      });
      for await (const event of stream1) { /* consume */ }

      const stream2 = await createChatStream({
        ...baseOptions,
        messages: [{ role: "user", content: "Hi" }]
      });
      for await (const event of stream2) { /* consume */ }

      expect(await getCacheSize()).toBe(2);
      expect(testProvider.getUsage().requests).toBe(2);
    });

    it("should cache differently for different temperature", async () => {
      const baseOptions = {
        model: "test-model",
        messages: [{ role: "user" as const, content: "test" }],
        cache: { mode: "read-through" as const }
      };

      const stream1 = await createChatStream({ ...baseOptions, temperature: 0.7 });
      for await (const event of stream1) { /* consume */ }

      const stream2 = await createChatStream({ ...baseOptions, temperature: 0.9 });
      for await (const event of stream2) { /* consume */ }

      expect(await getCacheSize()).toBe(2);
      expect(testProvider.getUsage().requests).toBe(2);
    });

    it("should cache differently for different tools", async () => {
      const baseOptions = {
        model: "test-model",
        messages: [{ role: "user" as const, content: "test" }],
        cache: { mode: "read-through" as const }
      };

      const stream1 = await createChatStream({
        ...baseOptions,
        tools: [{ name: "tool1", parameters: {} }]
      });
      for await (const event of stream1) { /* consume */ }

      const stream2 = await createChatStream({
        ...baseOptions,
        tools: [{ name: "tool2", parameters: {} }]
      });
      for await (const event of stream2) { /* consume */ }

      expect(await getCacheSize()).toBe(2);
      expect(testProvider.getUsage().requests).toBe(2);
    });
  });

  describe("TTL behavior", () => {
    it("should respect TTL settings", async () => {
      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "read-through", ttlMs: 100 } // Short TTL for quick test
      };

      // First request
      const stream1 = await createChatStream(chatOptions);
      for await (const event of stream1) { /* consume */ }

      expect(await getCacheSize()).toBe(1);
      expect(testProvider.getUsage().requests).toBe(1);

      // Second request immediately - should hit cache
      const stream2 = await createChatStream(chatOptions);
      for await (const event of stream2) { /* consume */ }

      expect(testProvider.getUsage().requests).toBe(1); // Still cached

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third request after expiry - should miss cache
      const stream3 = await createChatStream(chatOptions);
      for await (const event of stream3) { /* consume */ }

      expect(testProvider.getUsage().requests).toBe(2); // Cache miss, called provider again
    });
  });

  describe("prompt hashing privacy", () => {
    it("should hash prompts when hashPrompts is enabled", async () => {
      const sensitiveOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "Sensitive data: SSN 123-45-6789" }]
      };

      // Request without hashing
      const stream1 = await createChatStream({
        ...sensitiveOptions,
        cache: { mode: "read-through", hashPrompts: false }
      });
      for await (const event of stream1) { /* consume */ }

      // Request with hashing - should create different cache entry
      const stream2 = await createChatStream({
        ...sensitiveOptions,
        cache: { mode: "read-through", hashPrompts: true }
      });
      for await (const event of stream2) { /* consume */ }

      expect(await getCacheSize()).toBe(2); // Different cache entries
      expect(testProvider.getUsage().requests).toBe(2);
    });
  });

  describe("streaming with caching", () => {
    it("should cache complete stream events", async () => {
      // Set up provider with streaming response
      const streamingProvider = new TestProvider({
        responses: [
          { 
            chunks: ["Hello", " world"],
            usage: { prompt: 10, completion: 5 }
          }
        ]
      });
      setProvider(streamingProvider);

      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "read-through" }
      };

      // First request
      const stream1 = await createChatStream(chatOptions);
      const events1: StreamEvent[] = [];
      for await (const event of stream1) {
        events1.push(event);
      }

      expect(events1.length).toBeGreaterThan(0);
      expect(streamingProvider.getUsage().requests).toBe(1);

      // Second request - should be cached
      const stream2 = await createChatStream(chatOptions);
      const events2: StreamEvent[] = [];
      for await (const event of stream2) {
        events2.push(event);
      }

      expect(events1).toEqual(events2);
      expect(streamingProvider.getUsage().requests).toBe(1); // No additional call
    });
  });

  describe("error scenarios", () => {
    it("should not cache on provider errors", async () => {
      const errorProvider = new TestProvider({
        shouldError: true,
        errorMessage: "Provider error"
      });
      setProvider(errorProvider);

      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "read-through" }
      };

      // First request should error
      try {
        const stream = await createChatStream(chatOptions);
        for await (const event of stream) {
          if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      } catch (error) {
        // Expected error
      }

      // Cache should be empty
      expect(await getCacheSize()).toBe(0);
    });
  });

  describe("metrics tracking", () => {
    it("should track cache metrics correctly", async () => {
      // Reset metrics for clean test
      const metrics = getCacheMetrics();
      metrics.reset();

      const chatOptions: ChatOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        cache: { mode: "read-through" }
      };

      // First request - miss
      const stream1 = await createChatStream(chatOptions);
      for await (const event of stream1) { /* consume */ }

      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);

      // Second request - hit
      const stream2 = await createChatStream(chatOptions);
      for await (const event of stream2) { /* consume */ }

      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);

      // Check hit rate
      expect(metrics.getHitRate()).toBe(50); // 1 hit, 1 miss = 50%
    });
  });
});