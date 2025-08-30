// src/cache/__tests__/cache-manager.test.ts
// Tests for cache manager and cache modes

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheManager } from "../cache-manager.js";
import { MemoryCache } from "../memory-cache.js";
import { DefaultCacheKeyGenerator } from "../key-generator.js";
import type { ChatOptions, StreamEvent } from "../../types.js";
import type { CacheOptions } from "../types.js";

describe("CacheManager", () => {
  let cacheManager: CacheManager;
  let mockCache: MemoryCache;
  let keyGenerator: DefaultCacheKeyGenerator;
  let mockChatOptions: ChatOptions;
  let mockEvents: StreamEvent[];

  beforeEach(() => {
    mockCache = new MemoryCache();
    keyGenerator = new DefaultCacheKeyGenerator();
    cacheManager = new CacheManager(mockCache, keyGenerator);
    
    mockChatOptions = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }]
    };
    
    mockEvents = [
      { type: "text", value: "Hi there!" },
      { type: "end", usage: { prompt: 10, completion: 5 } }
    ];
  });

  describe("lookup", () => {
    it("should return cache miss for bypass mode", async () => {
      const result = await cacheManager.lookup(mockChatOptions, { mode: "bypass" });
      
      expect(result.hit).toBe(false);
      expect(result.events).toBeUndefined();
      expect(result.cacheKey).toBeTruthy();
    });

    it("should return cache miss for record-only mode", async () => {
      const result = await cacheManager.lookup(mockChatOptions, { mode: "record-only" });
      
      expect(result.hit).toBe(false);
      expect(result.events).toBeUndefined();
      expect(result.cacheKey).toBeTruthy();
    });

    it("should return cache miss for read-through mode when no cached entry", async () => {
      const result = await cacheManager.lookup(mockChatOptions, { mode: "read-through" });
      
      expect(result.hit).toBe(false);
      expect(result.events).toBeUndefined();
      expect(result.cacheKey).toBeTruthy();
    });

    it("should return cache hit for read-through mode when entry exists", async () => {
      const cacheOpts: CacheOptions = { mode: "read-through" };
      
      // First store something
      const cacheKey = await keyGenerator.generateKey(mockChatOptions, cacheOpts);
      await cacheManager.store(cacheKey, mockEvents, cacheOpts);
      
      // Then lookup
      const result = await cacheManager.lookup(mockChatOptions, cacheOpts);
      
      expect(result.hit).toBe(true);
      expect(result.events).toEqual(mockEvents);
      expect(result.cacheKey).toBe(cacheKey);
    });
  });

  describe("store", () => {
    it("should not store for bypass mode", async () => {
      const cacheKey = "test-key";
      await cacheManager.store(cacheKey, mockEvents, { mode: "bypass" });
      
      const cached = await mockCache.get(cacheKey);
      expect(cached).toBeNull();
    });

    it("should store for read-through mode", async () => {
      const cacheKey = "test-key";
      const metadata = { provider: "test", model: "gpt-4", usage: { prompt: 10, completion: 5 } };
      
      await cacheManager.store(cacheKey, mockEvents, { mode: "read-through" }, metadata);
      
      const cached = await mockCache.get(cacheKey);
      expect(cached).toBeTruthy();
      expect(cached!.events).toEqual(mockEvents);
      expect(cached!.metadata).toEqual(metadata);
    });

    it("should store for record-only mode", async () => {
      const cacheKey = "test-key";
      
      await cacheManager.store(cacheKey, mockEvents, { mode: "record-only" });
      
      const cached = await mockCache.get(cacheKey);
      expect(cached).toBeTruthy();
      expect(cached!.events).toEqual(mockEvents);
    });

    it("should respect TTL when storing", async () => {
      vi.useFakeTimers();
      
      const cacheKey = "test-key";
      await cacheManager.store(cacheKey, mockEvents, { 
        mode: "read-through", 
        ttlMs: 1000 
      });
      
      // Should exist initially
      expect(await mockCache.get(cacheKey)).toBeTruthy();
      
      // Should be expired after TTL
      vi.advanceTimersByTime(1500);
      expect(await mockCache.get(cacheKey)).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe("collectStreamEvents", () => {
    it("should collect all events from a stream", async () => {
      async function* mockStream(): AsyncIterable<StreamEvent> {
        yield { type: "text", value: "Hello" };
        yield { type: "text", value: " World" };
        yield { type: "end" };
      }

      const events = await cacheManager.collectStreamEvents(mockStream());
      
      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: "text", value: "Hello" });
      expect(events[1]).toEqual({ type: "text", value: " World" });
      expect(events[2]).toEqual({ type: "end" });
    });

    it("should handle empty streams", async () => {
      async function* emptyStream(): AsyncIterable<StreamEvent> {
        return;
      }

      const events = await cacheManager.collectStreamEvents(emptyStream());
      expect(events).toHaveLength(0);
    });
  });

  describe("eventsToStream", () => {
    it("should convert events array back to stream", async () => {
      const events: StreamEvent[] = [
        { type: "text", value: "Hello" },
        { type: "end" }
      ];

      const stream = cacheManager.eventsToStream(events);
      const collected = [];
      
      for await (const event of stream) {
        collected.push(event);
      }
      
      expect(collected).toEqual(events);
    });

    it("should handle empty events array", async () => {
      const stream = cacheManager.eventsToStream([]);
      const collected = [];
      
      for await (const event of stream) {
        collected.push(event);
      }
      
      expect(collected).toHaveLength(0);
    });
  });

  describe("cache management", () => {
    it("should provide access to metrics", () => {
      const metrics = cacheManager.getMetrics();
      expect(metrics).toBeTruthy();
      expect(typeof metrics.getHitRate).toBe("function");
    });

    it("should clear the cache", async () => {
      const cacheKey = "test-key";
      await cacheManager.store(cacheKey, mockEvents, { mode: "read-through" });
      
      expect(await cacheManager.size()).toBe(1);
      
      await cacheManager.clear();
      
      expect(await cacheManager.size()).toBe(0);
    });

    it("should return cache size", async () => {
      expect(await cacheManager.size()).toBe(0);
      
      await cacheManager.store("key1", mockEvents, { mode: "read-through" });
      await cacheManager.store("key2", mockEvents, { mode: "read-through" });
      
      expect(await cacheManager.size()).toBe(2);
    });
  });

  describe("integration scenarios", () => {
    it("should handle full cache workflow for read-through mode", async () => {
      const cacheOpts: CacheOptions = { mode: "read-through" };
      
      // Initial lookup should be a miss
      const lookup1 = await cacheManager.lookup(mockChatOptions, cacheOpts);
      expect(lookup1.hit).toBe(false);
      
      // Store the result
      await cacheManager.store(lookup1.cacheKey, mockEvents, cacheOpts, {
        provider: "test",
        model: mockChatOptions.model
      });
      
      // Second lookup should be a hit
      const lookup2 = await cacheManager.lookup(mockChatOptions, cacheOpts);
      expect(lookup2.hit).toBe(true);
      expect(lookup2.events).toEqual(mockEvents);
      
      // Keys should be the same
      expect(lookup1.cacheKey).toBe(lookup2.cacheKey);
    });

    it("should handle privacy with prompt hashing", async () => {
      const sensitiveOptions: ChatOptions = {
        model: "gpt-4",
        messages: [{ role: "user", content: "My SSN is 123-45-6789" }]
      };
      
      const normalCacheOpts: CacheOptions = { mode: "read-through", hashPrompts: false };
      const privateCacheOpts: CacheOptions = { mode: "read-through", hashPrompts: true };
      
      const normalKey = await keyGenerator.generateKey(sensitiveOptions, normalCacheOpts);
      const privateKey = await keyGenerator.generateKey(sensitiveOptions, privateCacheOpts);
      
      // Keys should be different
      expect(normalKey).not.toBe(privateKey);
      
      // Both should work independently
      await cacheManager.store(normalKey, mockEvents, normalCacheOpts);
      await cacheManager.store(privateKey, [...mockEvents, { type: "text", value: "private" }], privateCacheOpts);
      
      const normalLookup = await cacheManager.lookup(sensitiveOptions, normalCacheOpts);
      const privateLookup = await cacheManager.lookup(sensitiveOptions, privateCacheOpts);
      
      expect(normalLookup.hit).toBe(true);
      expect(privateLookup.hit).toBe(true);
      expect(normalLookup.events).not.toEqual(privateLookup.events);
    });
  });
});