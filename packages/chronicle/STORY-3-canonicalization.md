# Story 3: Event Canonicalization & Hashing

## Goal

Implement event ID computation using canonical JSON and SHA-256 hashing for idempotent appends and causal chains.

## Acceptance Criteria

From CONTRACT.md `@sage/chronicle` section:

- [x] `eventId` computed as SHA-256 of canonical JSON representation
- [x] Idempotent appends - duplicate `eventId` handling
- [x] Support for `prevEventId` causal chaining
- [x] `computeId` option in `AppendOptions`

## Implementation Plan

### Phase 1: Event Canonicalization

- Use `@sage/utils` `canonicalJSONStringify` for deterministic serialization
- Define which event fields participate in ID computation
- Handle optional fields consistently (exclude `eventId` itself from hash)
- Test canonicalization with complex event payloads

### Phase 2: ID Computation & Caching

- Implement `computeEventId(event)` helper function
- Use `@sage/utils` `sha256` for hashing
- Cache computed IDs to avoid recomputation
- Handle both user-provided and computed event IDs

### Phase 3: Idempotent Append Logic

- Check for duplicate `eventId` before append
- Define idempotency semantics (skip vs. error vs. update)
- Handle edge cases around partial failures
- Efficient duplicate detection without loading entire file

### Phase 4: Causal Chain Support

- Implement `prevEventId` linking
- Validate causal chain consistency where applicable
- Support for Chronicle recovery and repair
- Chain traversal utilities for debugging

### Phase 5: Integration & Testing

- Integrate with append operations from Story 2
- Test idempotency under concurrent access
- Validate hash consistency across Node.js versions
- Performance testing with large Chronicles

## Dependencies

- `@sage/utils` for `canonicalJSONStringify` and `sha256`
- Story 2 (File Operations) for append infrastructure

## Estimated Effort

**~~4-5 hours~~** - ✅ **COMPLETED** - Hash computation and idempotency logic fully implemented.

## Success Metrics ✅ ALL ACHIEVED

- [x] Identical events produce identical `eventId` hashes
- [x] Concurrent appends handle duplicates correctly
- [x] Causal chains can be traversed and validated
- [x] Performance remains acceptable with large Chronicles

## Current Status: ✅ COMPLETED

This story is **fully implemented** with advanced hashing and causal chain features:

**✅ Canonicalization & Hashing:**
- Complete event canonicalization system in `src/canonicalization.ts`
- SHA-256 hashing using `@sage/utils` with proper field exclusion
- Event ID verification and integrity checking
- Batch processing utilities for performance

**✅ Idempotency & Deduplication:**
- Sophisticated duplicate detection in `src/optimization.ts`
- Event index maintenance for fast lookups
- Batch duplicate checking for bulk operations
- Proper handling of concurrent append scenarios

**✅ Causal Chain Support:**
- Complete causal chain implementation in `src/causal-chain.ts`
- Chain building, validation, and traversal utilities
- Chain repair and consistency checking
- Support for Chronicle reconstruction from chains

**✅ Advanced Features:**
- Chronicle analysis and repair utilities in `src/analysis.ts`
- Performance optimizations for large Chronicles
- Memory-efficient operations for long-running processes
- Comprehensive testing infrastructure

**Key Implementation Files:**
- `src/canonicalization.ts` - Event canonicalization and hashing
- `src/causal-chain.ts` - Causal chain management and validation
- `src/optimization.ts` - Performance and deduplication utilities
- `src/analysis.ts` - Chronicle analysis and repair tools

**Production Ready:** This implementation includes features beyond the original scope, including Chronicle repair, analysis tools, and sophisticated performance optimizations.
