// src/cache/key-generator.ts
// Canonical key generation for cache entries

import type { ChatOptions } from "../types.js";
import type { CacheKeyGenerator, CacheOptions, CacheKeyComponents } from "./types.js";

/**
 * Default cache key generator using canonical JSON and SHA-256 hashing
 */
export class DefaultCacheKeyGenerator implements CacheKeyGenerator {
  
  async generateKey(opts: ChatOptions, cacheOpts: CacheOptions): Promise<string> {
    const components = await this.extractKeyComponents(opts, cacheOpts);
    const canonicalString = this.canonicalizeComponents(components);
    return this.hashString(canonicalString);
  }
  
  async hashMessages(messages: ChatOptions['messages']): Promise<string> {
    const canonicalMessages = this.canonicalizeJSON(messages);
    return this.hashString(canonicalMessages);
  }
  
  /**
   * Extract cache-relevant components from ChatOptions
   */
  private async extractKeyComponents(opts: ChatOptions, cacheOpts: CacheOptions): Promise<CacheKeyComponents> {
    const components: CacheKeyComponents = {
      model: opts.model,
      messages: cacheOpts.hashPrompts 
        ? await this.hashMessages(opts.messages)
        : this.canonicalizeJSON(opts.messages)
    };
    
    // Include optional parameters if present
    if (opts.tools && opts.tools.length > 0) {
      components.tools = this.canonicalizeJSON(opts.tools);
    }
    
    if (opts.temperature !== undefined) {
      components.temperature = opts.temperature;
    }
    
    if (opts.max_tokens !== undefined) {
      components.max_tokens = opts.max_tokens;
    }
    
    if (cacheOpts.hashPrompts) {
      components.hashedPrompts = true;
    }
    
    return components;
  }
  
  /**
   * Create a canonical string representation of cache key components
   */
  private canonicalizeComponents(components: CacheKeyComponents): string {
    return this.canonicalizeJSON(components);
  }
  
  /**
   * Canonicalize JSON to ensure deterministic key generation
   * This implementation provides basic canonicalization - for production
   * use, consider using @sage/utils canonicalization utilities
   */
  private canonicalizeJSON(obj: unknown): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    
    switch (typeof obj) {
      case 'boolean':
      case 'number':
        return String(obj);
      case 'string':
        return JSON.stringify(obj);
      case 'object':
        if (Array.isArray(obj)) {
          return '[' + obj.map(item => this.canonicalizeJSON(item)).join(',') + ']';
        } else {
          const keys = Object.keys(obj as Record<string, unknown>).sort();
          const pairs = keys.map(key => {
            const value = (obj as Record<string, unknown>)[key];
            return JSON.stringify(key) + ':' + this.canonicalizeJSON(value);
          });
          return '{' + pairs.join(',') + '}';
        }
      default:
        throw new Error(`Cannot canonicalize value of type ${typeof obj}`);
    }
  }
  
  /**
   * Hash a string using SHA-256
   * For now using a simple hash, but should use crypto utilities from @sage/utils
   */
  private async hashString(input: string): Promise<string> {
    // Simple hash implementation for now - in production, use crypto utilities
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for Node.js environments without Web Crypto API
      const crypto = await import('crypto');
      return crypto.createHash('sha256').update(input).digest('hex');
    }
  }
}

/**
 * Default instance for convenience
 */
export const defaultCacheKeyGenerator = new DefaultCacheKeyGenerator();