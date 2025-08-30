// src/cache/types.ts
// Core types for the LLM caching system

import type { ChatOptions, StreamEvent } from "../types.js";

/**
 * Cache modes determining how caching behaves
 */
export type CacheMode = 
  | "read-through"   // Read from cache, write to cache on miss
  | "record-only"    // Only write to cache, never read
  | "bypass";        // Skip cache entirely

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Cache mode determines read/write behavior */
  mode: CacheMode;
  /** Enable prompt hashing for privacy (default: false) */
  hashPrompts?: boolean;
  /** Time-to-live for cache entries in milliseconds */
  ttlMs?: number;
  /** Maximum number of entries in the cache */
  maxEntries?: number;
}

/**
 * A cached chat result containing the complete stream
 */
export interface CachedResult {
  /** The complete list of stream events */
  events: StreamEvent[];
  /** When this entry was cached */
  timestamp: Date;
  /** Optional metadata about the cache entry */
  metadata?: {
    provider: string;
    model: string;
    usage?: { prompt: number; completion: number };
  };
}

/**
 * Cache key components for canonical hashing
 */
export interface CacheKeyComponents {
  model: string;
  messages: string; // Canonicalized JSON string
  tools?: string;   // Canonicalized JSON string
  temperature?: number;
  max_tokens?: number;
  /** Whether the messages were hashed for privacy */
  hashedPrompts?: boolean;
}

/**
 * Cache hit/miss tracking metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  errors: number;
  /** Get hit rate as a percentage */
  getHitRate(): number;
  /** Reset all metrics */
  reset(): void;
}

/**
 * Core cache interface
 */
export interface LLMCache {
  /** Get a cached result if it exists and is valid */
  get(key: string): Promise<CachedResult | null>;
  
  /** Store a result in the cache */
  set(key: string, result: CachedResult, options?: { ttlMs?: number }): Promise<void>;
  
  /** Check if a key exists in the cache */
  has(key: string): Promise<boolean>;
  
  /** Remove a specific entry from the cache */
  delete(key: string): Promise<void>;
  
  /** Clear all cache entries */
  clear(): Promise<void>;
  
  /** Get cache metrics */
  getMetrics(): CacheMetrics;
  
  /** Get cache size (number of entries) */
  size(): Promise<number>;
}

/**
 * Cache key generation function
 */
export interface CacheKeyGenerator {
  /** Generate a cache key from chat options */
  generateKey(opts: ChatOptions, cacheOpts: CacheOptions): Promise<string>;
  
  /** Generate a hash of the messages for privacy */
  hashMessages(messages: ChatOptions['messages']): Promise<string>;
}