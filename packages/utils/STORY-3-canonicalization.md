# Story 3: Canonicalization & Crypto

## Goal

Implement deterministic JSON serialization and hashing functions critical for Chronicle event IDs and caching.

## Acceptance Criteria

From CONTRACT.md `@sage/utils` section:

- [ ] `canonicalJSONStringify(o: unknown): string` with stable key ordering
- [ ] `sha256(text: string | Uint8Array): Promise<string>` returning lowercase hex
- [ ] Must be stable across Node versions for object key order
- [ ] SHA-256 output must match OpenSSL

## Implementation Plan

### Phase 1: Canonical JSON Stringify

- Create `src/canonical.ts` with deterministic JSON serialization
- Recursively sort object keys alphabetically at all nesting levels
- Handle arrays, primitives, null, undefined consistently
- Preserve exact JSON.stringify behavior except for key ordering

### Phase 2: SHA-256 Implementation

- Create `src/crypto.ts` using Node.js crypto module
- Support both string and Uint8Array inputs
- Return lowercase hexadecimal string
- Handle encoding properly (UTF-8 for strings)

### Phase 3: Cross-Platform Compatibility

- Ensure works in Node.js and browser environments
- Use Web Crypto API as fallback for browser contexts
- Add proper TypeScript types for all platforms

### Phase 4: Validation & Testing

- Create test vectors matching OpenSSL output
- Test canonical JSON against complex nested objects
- Verify deterministic behavior across multiple runs
- Performance testing for large objects

## Dependencies

- Node.js `crypto` module (built-in)
- Web Crypto API for browser compatibility

## Estimated Effort

**3-4 hours** - Need to handle cross-platform crypto properly and validate against known test vectors.

## Success Metrics

- `canonicalJSONStringify({c:3,a:1,b:[{y:2,x:1}]}) === '{"a":1,"b":[{"x":1,"y":2}],"c":3}'`
- SHA-256 of "hello" matches expected hash from OpenSSL
- Works identically in Node.js and browser environments
- Performance acceptable for objects up to several MB
