// src/cache/memory-cache.ts
// In-memory LRU cache implementation with TTL support

import type { LLMCache, CachedResult, CacheMetrics } from "./types.js";

/**
 * Cache entry with TTL and LRU tracking
 */
interface CacheEntry {
  result: CachedResult;
  expiresAt?: Date;
  lastAccessed: Date;
}

/**
 * In-memory cache metrics implementation
 */
class MemoryCacheMetrics implements CacheMetrics {
  hits = 0;
  misses = 0;
  writes = 0;
  evictions = 0;
  errors = 0;
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
  
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.writes = 0;
    this.evictions = 0;
    this.errors = 0;
  }
}

/**
 * In-memory LRU cache with TTL support
 */
export class MemoryCache implements LLMCache {
  private entries = new Map<string, CacheEntry>();
  private metrics = new MemoryCacheMetrics();
  private maxEntries: number;
  private defaultTtlMs?: number;
  
  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs;
  }
  
  async get(key: string): Promise<CachedResult | null> {
    const entry = this.entries.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      return null;
    }
    
    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.entries.delete(key);
      this.metrics.misses++;
      return null;
    }
    
    // Update last accessed time for LRU
    entry.lastAccessed = new Date();
    
    // Move to end (most recently used)
    this.entries.delete(key);
    this.entries.set(key, entry);
    
    this.metrics.hits++;
    return entry.result;
  }
  
  async set(key: string, result: CachedResult, options: { ttlMs?: number } = {}): Promise<void> {
    try {
      // Calculate expiration time
      const ttlMs = options.ttlMs ?? this.defaultTtlMs;
      const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : undefined;
      
      // Create cache entry
      const entry: CacheEntry = {
        result,
        expiresAt,
        lastAccessed: new Date()
      };
      
      // Remove existing entry if it exists
      if (this.entries.has(key)) {
        this.entries.delete(key);
      }
      
      // Add new entry
      this.entries.set(key, entry);
      
      // Evict oldest entries if we exceed max size
      this.evictIfNeeded();
      
      this.metrics.writes++;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }
  
  async has(key: string): Promise<boolean> {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.entries.delete(key);
      return false;
    }
    
    return true;
  }
  
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
  
  async clear(): Promise<void> {
    this.entries.clear();
    // Don't reset metrics on clear - they're still valuable
  }
  
  getMetrics(): CacheMetrics {
    return this.metrics;
  }
  
  async size(): Promise<number> {
    // Clean up expired entries first
    this.cleanupExpired();
    return this.entries.size;
  }
  
  /**
   * Evict oldest entries if we exceed max size
   */
  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      // Get the oldest entry (first in the Map)
      const firstKey = this.entries.keys().next().value;
      if (firstKey) {
        this.entries.delete(firstKey);
        this.metrics.evictions++;
      }
    }
  }
  
  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.entries.delete(key);
    }
  }
}

/**
 * Default memory cache instance
 */
export const defaultMemoryCache = new MemoryCache();