# @sage/utils - Implementation Context

## Package Purpose
Foundation package providing shared types, error handling, and deterministic operations for all SAGE packages.

## Contract Requirements (from CONTRACT.md)

### Types & Interfaces
```ts
export type ISO8601 = string; // "2024-01-01T12:00:00.000Z"
export interface Clock { now(): ISO8601 }
export interface Random { int(): number; float(): number }
export interface TypedError extends Error { code: string; cause?: unknown }
```

### Functions
```ts
export function err(code: string, message: string, cause?: unknown): TypedError;
export function canonicalJSONStringify(o: unknown): string; // stable key order
export function sha256(text: string | Uint8Array): Promise<string>; // lowercase hex
```

## Key Requirements
- **Zero runtime dependencies** (except crypto)
- **Cross-platform**: Node.js and browser compatible
- **Deterministic**: `canonicalJSONStringify` must be stable across Node versions
- **OpenSSL compatible**: SHA-256 output must match OpenSSL exactly

## Error Code Taxonomy
- `EVALIDATION` - Schema/argument failures
- `EPERMISSION` - Denied by path/policy  
- `ETIMEOUT` - Tool or provider timeout
- `EIO` - Filesystem/database/network failure
- `ELOCK_TIMEOUT` - Chronicle file lock contention
- `EHALT` - Bullet Wound Invariant triggered

## Success Criteria
- `canonicalJSONStringify({c:3,a:1,b:[{y:2,x:1}]}) === '{"a":1,"b":[{"x":1,"y":2}],"c":3}'`
- SHA-256 of "hello" matches OpenSSL output
- TypedError maintains proper stack traces and prototype chains
- All implementations work identically in Node.js and browser environments

## Dependencies
None - this is the foundation.