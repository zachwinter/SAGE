// src/cache/cache-manager.ts
// Cache manager that handles different cache modes and integrates with the API

import type { ChatOptions, StreamEvent } from "../types.js";
import type { LLMCache, CacheOptions, CachedResult, CacheKeyGenerator } from "./types.js";
import { DefaultCacheKeyGenerator, defaultCacheKeyGenerator } from "./key-generator.js";
import { MemoryCache, defaultMemoryCache } from "./memory-cache.js";

/**
 * Result of a cache lookup operation
 */
export interface CacheLookupResult {
  /** Whether this was a cache hit */
  hit: boolean;
  /** The cached events if it was a hit */
  events?: StreamEvent[];
  /** The cache key used for this lookup */
  cacheKey: string;
}

/**
 * Cache manager that orchestrates caching behavior based on cache mode
 */
export class CacheManager {
  private cache: LLMCache;
  private keyGenerator: CacheKeyGenerator;
  
  constructor(
    cache: LLMCache = defaultMemoryCache,
    keyGenerator: CacheKeyGenerator = defaultCacheKeyGenerator
  ) {
    this.cache = cache;
    this.keyGenerator = keyGenerator;
  }
  
  /**
   * Attempt to get cached result based on cache mode
   */
  async lookup(opts: ChatOptions, cacheOpts: CacheOptions): Promise<CacheLookupResult> {
    const cacheKey = await this.keyGenerator.generateKey(opts, cacheOpts);
    
    // Bypass mode never reads from cache
    if (cacheOpts.mode === "bypass") {
      return { hit: false, cacheKey };
    }
    
    // Record-only mode never reads from cache
    if (cacheOpts.mode === "record-only") {
      return { hit: false, cacheKey };
    }
    
    // Read-through mode: try to get from cache
    if (cacheOpts.mode === "read-through") {
      const cachedResult = await this.cache.get(cacheKey);
      
      if (cachedResult) {
        return {
          hit: true,
          events: cachedResult.events,
          cacheKey
        };
      }
    }
    
    return { hit: false, cacheKey };
  }
  
  /**
   * Store result in cache based on cache mode
   */
  async store(
    cacheKey: string, 
    events: StreamEvent[], 
    cacheOpts: CacheOptions,
    metadata?: { provider: string; model: string; usage?: { prompt: number; completion: number } }
  ): Promise<void> {
    // Bypass mode never writes to cache
    if (cacheOpts.mode === "bypass") {
      return;
    }
    
    // Both read-through and record-only modes write to cache
    if (cacheOpts.mode === "read-through" || cacheOpts.mode === "record-only") {
      const cachedResult: CachedResult = {
        events,
        timestamp: new Date(),
        metadata
      };
      
      const storeOptions = cacheOpts.ttlMs ? { ttlMs: cacheOpts.ttlMs } : undefined;
      await this.cache.set(cacheKey, cachedResult, storeOptions);
    }
  }
  
  /**
   * Collect all events from a stream and return them as an array
   * This is needed for full-turn caching
   */
  async collectStreamEvents(stream: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    
    for await (const event of stream) {
      events.push(event);
    }
    
    return events;
  }
  
  /**
   * Convert an array of events back into an async iterable stream
   */
  async* eventsToStream(events: StreamEvent[]): AsyncIterable<StreamEvent> {
    for (const event of events) {
      yield event;
    }
  }
  
  /**
   * Get cache metrics
   */
  getMetrics() {
    return this.cache.getMetrics();
  }
  
  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  async size(): Promise<number> {
    return this.cache.size();
  }
}

/**
 * Default cache manager instance
 */
export const defaultCacheManager = new CacheManager();