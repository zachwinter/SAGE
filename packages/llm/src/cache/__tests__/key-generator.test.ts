// src/cache/__tests__/key-generator.test.ts
// Tests for cache key generation

import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCacheKeyGenerator } from "../key-generator.js";
import type { ChatOptions } from "../../types.js";
import type { CacheOptions } from "../types.js";

describe("DefaultCacheKeyGenerator", () => {
  let keyGenerator: DefaultCacheKeyGenerator;

  beforeEach(() => {
    keyGenerator = new DefaultCacheKeyGenerator();
  });

  describe("generateKey", () => {
    it("should generate consistent keys for identical inputs", async () => {
      const chatOpts: ChatOptions = {
        model: "gpt-4",
        messages: [
          { role: "user", content: "Hello, world!" }
        ]
      };
      const cacheOpts: CacheOptions = { mode: "read-through" };

      const key1 = await keyGenerator.generateKey(chatOpts, cacheOpts);
      const key2 = await keyGenerator.generateKey(chatOpts, cacheOpts);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it("should generate different keys for different models", async () => {
      const baseOpts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }]
      };
      const cacheOpts: CacheOptions = { mode: "read-through" };

      const key1 = await keyGenerator.generateKey(baseOpts, cacheOpts);
      const key2 = await keyGenerator.generateKey(
        { ...baseOpts, model: "gpt-3.5-turbo" }, 
        cacheOpts
      );

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different messages", async () => {
      const cacheOpts: CacheOptions = { mode: "read-through" };
      
      const key1 = await keyGenerator.generateKey({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      }, cacheOpts);
      
      const key2 = await keyGenerator.generateKey({
        model: "gpt-4", 
        messages: [{ role: "user", content: "Hi" }]
      }, cacheOpts);

      expect(key1).not.toBe(key2);
    });

    it("should include temperature in key generation", async () => {
      const baseOpts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }]
      };
      const cacheOpts: CacheOptions = { mode: "read-through" };

      const key1 = await keyGenerator.generateKey(baseOpts, cacheOpts);
      const key2 = await keyGenerator.generateKey(
        { ...baseOpts, temperature: 0.7 }, 
        cacheOpts
      );

      expect(key1).not.toBe(key2);
    });

    it("should include max_tokens in key generation", async () => {
      const baseOpts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }]
      };
      const cacheOpts: CacheOptions = { mode: "read-through" };

      const key1 = await keyGenerator.generateKey(baseOpts, cacheOpts);
      const key2 = await keyGenerator.generateKey(
        { ...baseOpts, max_tokens: 100 }, 
        cacheOpts
      );

      expect(key1).not.toBe(key2);
    });

    it("should include tools in key generation", async () => {
      const baseOpts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }]
      };
      const cacheOpts: CacheOptions = { mode: "read-through" };

      const key1 = await keyGenerator.generateKey(baseOpts, cacheOpts);
      const key2 = await keyGenerator.generateKey({
        ...baseOpts,
        tools: [{ name: "test_tool", parameters: {} }]
      }, cacheOpts);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys when prompt hashing is enabled", async () => {
      const chatOpts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "sensitive data" }]
      };

      const key1 = await keyGenerator.generateKey(chatOpts, { 
        mode: "read-through", 
        hashPrompts: false 
      });
      const key2 = await keyGenerator.generateKey(chatOpts, { 
        mode: "read-through", 
        hashPrompts: true 
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe("hashMessages", () => {
    it("should generate consistent hashes for identical messages", async () => {
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" }
      ];

      const hash1 = await keyGenerator.hashMessages(messages);
      const hash2 = await keyGenerator.hashMessages(messages);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it("should generate different hashes for different message order", async () => {
      const messages1 = [
        { role: "user" as const, content: "A" },
        { role: "user" as const, content: "B" }
      ];
      const messages2 = [
        { role: "user" as const, content: "B" },
        { role: "user" as const, content: "A" }
      ];

      const hash1 = await keyGenerator.hashMessages(messages1);
      const hash2 = await keyGenerator.hashMessages(messages2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty messages array", async () => {
      const hash = await keyGenerator.hashMessages([]);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle messages with tool_call_id", async () => {
      const messages = [
        { role: "user" as const, content: "Use tool", tool_call_id: "call_123" }
      ];

      const hash = await keyGenerator.hashMessages(messages);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("canonicalization", () => {
    it("should produce consistent results for objects with same properties in different order", async () => {
      // This tests the private canonicalizeJSON method indirectly
      const opts1: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        temperature: 0.7,
        max_tokens: 100
      };
      
      const opts2: ChatOptions = {
        max_tokens: 100,
        model: "gpt-4", 
        temperature: 0.7,
        messages: [{ role: "user", content: "test" }]
      };

      const cacheOpts: CacheOptions = { mode: "read-through" };
      const key1 = await keyGenerator.generateKey(opts1, cacheOpts);
      const key2 = await keyGenerator.generateKey(opts2, cacheOpts);

      expect(key1).toBe(key2);
    });

    it("should handle nested objects in tools", async () => {
      const opts: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [{
          name: "complex_tool",
          parameters: {
            nested: { a: 1, b: 2 },
            array: [3, 2, 1]
          }
        }]
      };

      const cacheOpts: CacheOptions = { mode: "read-through" };
      const key1 = await keyGenerator.generateKey(opts, cacheOpts);
      const key2 = await keyGenerator.generateKey(opts, cacheOpts);

      expect(key1).toBe(key2);
    });
  });
});