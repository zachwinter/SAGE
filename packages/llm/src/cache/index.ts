// src/cache/index.ts
// Public API for the caching system

export type {
  CacheMode,
  CacheOptions,
  CachedResult,
  CacheKeyComponents,
  CacheMetrics,
  LLMCache,
  CacheKeyGenerator
} from "./types.js";

export {
  DefaultCacheKeyGenerator,
  defaultCacheKeyGenerator
} from "./key-generator.js";

export {
  MemoryCache,
  defaultMemoryCache
} from "./memory-cache.js";

export {
  CacheManager,
  defaultCacheManager
} from "./cache-manager.js";

export type {
  CacheLookupResult
} from "./cache-manager.js";