# Story 2: Error Taxonomy & Helpers

## Goal

Implement the typed error system used throughout SAGE for consistent error handling and classification.

## Acceptance Criteria

From CONTRACT.md `@sage/utils` section:

- [ ] `TypedError` interface extending Error with `code` and optional `cause`
- [ ] `err()` function to create typed errors consistently
- [ ] Support for error code taxonomy (EVALIDATION, EIO, ETIMEOUT, etc.)

## Implementation Plan

### Phase 1: TypedError Interface

- Create `src/errors.ts` with `TypedError` interface
- Extend standard Error with required `code: string` property
- Add optional `cause?: unknown` for error chaining

### Phase 2: Error Factory Function

- Implement `err(code, message, cause?)` helper function
- Ensure proper Error prototype chain and stack traces
- Support additional properties via options parameter

### Phase 3: Error Code Constants

- Define constants for standard error codes:
  - `EVALIDATION` - Schema/argument failures
  - `EPERMISSION` - Denied by path/policy
  - `ETIMEOUT` - Tool or provider timeout
  - `EIO` - Filesystem/database/network failure
  - `ELOCK_TIMEOUT` - Chronicle file lock contention
  - `EHALT` - Bullet Wound Invariant triggered

### Phase 4: Error Utilities

- Helper functions for error type checking
- Error serialization for logging/transport
- Error message formatting utilities

## Dependencies

None - uses only Node.js built-in Error class.

## Estimated Effort

**2-3 hours** - Need to handle Error subclassing properly across different JS engines.

## Success Metrics

- Errors have proper stack traces and prototype chains
- Error codes are consistently used across SAGE packages
- Error serialization preserves all relevant information
- Works correctly in both development and production builds
