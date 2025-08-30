// src/cache/__tests__/memory-cache.test.ts
// Tests for in-memory cache implementation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache } from "../memory-cache.js";
import type { CachedResult } from "../types.js";

describe("MemoryCache", () => {
  let cache: MemoryCache;
  let mockResult: CachedResult;

  beforeEach(() => {
    cache = new MemoryCache({ maxEntries: 3, defaultTtlMs: 1000 });
    mockResult = {
      events: [
        { type: "text", value: "Hello" },
        { type: "end" }
      ],
      timestamp: new Date(),
      metadata: {
        provider: "test",
        model: "test-model"
      }
    };
  });

  describe("basic operations", () => {
    it("should store and retrieve values", async () => {
      await cache.set("key1", mockResult);
      const retrieved = await cache.get("key1");

      expect(retrieved).toEqual(mockResult);
    });

    it("should return null for non-existent keys", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should check if keys exist", async () => {
      await cache.set("key1", mockResult);
      
      expect(await cache.has("key1")).toBe(true);
      expect(await cache.has("nonexistent")).toBe(false);
    });

    it("should delete keys", async () => {
      await cache.set("key1", mockResult);
      await cache.delete("key1");

      expect(await cache.has("key1")).toBe(false);
      expect(await cache.get("key1")).toBeNull();
    });

    it("should clear all entries", async () => {
      await cache.set("key1", mockResult);
      await cache.set("key2", mockResult);
      await cache.clear();

      expect(await cache.size()).toBe(0);
      expect(await cache.has("key1")).toBe(false);
      expect(await cache.has("key2")).toBe(false);
    });

    it("should return correct size", async () => {
      expect(await cache.size()).toBe(0);
      
      await cache.set("key1", mockResult);
      expect(await cache.size()).toBe(1);
      
      await cache.set("key2", mockResult);
      expect(await cache.size()).toBe(2);
      
      await cache.delete("key1");
      expect(await cache.size()).toBe(1);
    });
  });

  describe("TTL (Time-To-Live)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should expire entries after default TTL", async () => {
      await cache.set("key1", mockResult);
      expect(await cache.get("key1")).not.toBeNull();

      // Fast-forward time beyond TTL
      vi.advanceTimersByTime(1500);
      
      expect(await cache.get("key1")).toBeNull();
      expect(await cache.has("key1")).toBe(false);
    });

    it("should expire entries after custom TTL", async () => {
      await cache.set("key1", mockResult, { ttlMs: 500 });
      expect(await cache.get("key1")).not.toBeNull();

      // Fast-forward to just before expiry
      vi.advanceTimersByTime(400);
      expect(await cache.get("key1")).not.toBeNull();

      // Fast-forward past expiry
      vi.advanceTimersByTime(200);
      expect(await cache.get("key1")).toBeNull();
    });

    it("should not expire entries without TTL", async () => {
      const cacheNoTtl = new MemoryCache({ maxEntries: 3 }); // No default TTL
      await cacheNoTtl.set("key1", mockResult);
      
      // Fast-forward a long time
      vi.advanceTimersByTime(10000);
      
      expect(await cacheNoTtl.get("key1")).not.toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entries when max size exceeded", async () => {
      // Fill cache to capacity
      await cache.set("key1", mockResult);
      await cache.set("key2", mockResult);
      await cache.set("key3", mockResult);
      
      expect(await cache.size()).toBe(3);

      // Add one more - should evict key1
      await cache.set("key4", mockResult);
      
      expect(await cache.size()).toBe(3);
      expect(await cache.has("key1")).toBe(false); // Evicted
      expect(await cache.has("key2")).toBe(true);
      expect(await cache.has("key3")).toBe(true);
      expect(await cache.has("key4")).toBe(true);
    });

    it("should update LRU order on access", async () => {
      await cache.set("key1", mockResult);
      await cache.set("key2", mockResult);
      await cache.set("key3", mockResult);
      
      // Access key1 to make it recently used
      await cache.get("key1");
      
      // Add key4 - should evict key2 (oldest unused)
      await cache.set("key4", mockResult);
      
      expect(await cache.has("key1")).toBe(true); // Should still be there
      expect(await cache.has("key2")).toBe(false); // Should be evicted
      expect(await cache.has("key3")).toBe(true);
      expect(await cache.has("key4")).toBe(true);
    });
  });

  describe("metrics", () => {
    it("should track cache hits and misses", async () => {
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);

      // Miss
      await cache.get("nonexistent");
      expect(metrics.misses).toBe(1);

      // Store and hit
      await cache.set("key1", mockResult);
      await cache.get("key1");
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    it("should track writes", async () => {
      const metrics = cache.getMetrics();
      expect(metrics.writes).toBe(0);

      await cache.set("key1", mockResult);
      expect(metrics.writes).toBe(1);

      await cache.set("key2", mockResult);
      expect(metrics.writes).toBe(2);
    });

    it("should track evictions", async () => {
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(0);

      // Fill cache beyond capacity
      await cache.set("key1", mockResult);
      await cache.set("key2", mockResult);
      await cache.set("key3", mockResult);
      await cache.set("key4", mockResult); // Triggers eviction

      expect(metrics.evictions).toBe(1);
    });

    it("should calculate hit rate correctly", async () => {
      const metrics = cache.getMetrics();
      
      // No requests yet
      expect(metrics.getHitRate()).toBe(0);

      await cache.set("key1", mockResult);
      
      // 1 miss, 0 hits
      await cache.get("nonexistent");
      expect(metrics.getHitRate()).toBe(0);

      // 1 miss, 1 hit
      await cache.get("key1");
      expect(metrics.getHitRate()).toBe(50);

      // 1 miss, 2 hits
      await cache.get("key1");
      expect(metrics.getHitRate()).toBeCloseTo(66.67);
    });

    it("should reset metrics", async () => {
      const metrics = cache.getMetrics();
      
      await cache.set("key1", mockResult);
      await cache.get("key1");
      await cache.get("nonexistent");
      
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.writes).toBe(1);
      
      metrics.reset();
      
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.writes).toBe(0);
      expect(metrics.evictions).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should have error tracking capability in metrics", async () => {
      const metrics = cache.getMetrics();
      
      // The error counter should be accessible (for future use)
      expect(metrics.errors).toBe(0);
      expect(typeof metrics.errors).toBe('number');
      
      // Error tracking is available for when cache implementations need it
      // (e.g., Redis cache, file cache, etc.)
    });
  });
});