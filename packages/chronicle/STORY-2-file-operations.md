# Story 2: File Operations & Concurrency

## Goal

Implement the core file I/O operations with proper concurrency control, atomic writes, and crash safety.

## Acceptance Criteria

From CONTRACT.md `@sage/chronicle` section:

- [x] NDJSON format (one JSON object per line)
- [x] Advisory file locking during appends
- [x] Atomic writes with fsync for durability
- [x] Crash safety - partial lines ignored on read
- [x] Concurrent append linearization
- [x] Lock timeout handling with `ELOCK_TIMEOUT`

## Implementation Plan

### Phase 1: File Reading

- Implement `readChronicle()` with NDJSON parsing
- Handle corrupt/partial lines gracefully (skip and warn)
- Stream-friendly reading for large files
- Proper error handling for missing files vs. I/O errors

### Phase 2: File Locking

- Research cross-platform file locking (flock on Unix, LockFile on Windows)
- Implement advisory locking wrapper
- Timeout mechanism with configurable duration
- Clean lock release on process exit/error

### Phase 3: Atomic Append Operations

- Write-to-temp-then-rename pattern for atomicity
- OR use O_APPEND with proper error handling
- fsync before rename to ensure durability
- Handle edge cases (disk full, permissions, etc.)

### Phase 4: Concurrency Testing

- Test multiple processes appending simultaneously
- Verify no interleaved bytes or corrupted JSON
- Test lock timeout and recovery scenarios
- Performance testing under contention

### Phase 5: Cross-Platform Compatibility

- Test on macOS, Linux, and Windows
- Handle platform-specific locking behavior
- Path normalization and validation
- Proper error codes and messages

## Dependencies

- Node.js `fs`, `path` modules
- `@sage/utils` for error handling

## Estimated Effort

**~~6-8 hours~~** - ✅ **COMPLETED** - File locking and atomic operations fully implemented.

## Success Metrics ✅ ALL ACHIEVED

- [x] No data corruption under concurrent access
- [x] Lock timeouts work reliably across platforms
- [x] Atomic writes survive process crashes and disk issues
- [x] Performance acceptable with hundreds of appends/second

## Current Status: ✅ COMPLETED

This story is **fully implemented** with industrial-strength file operations:

**✅ File Operations Implemented:**
- Complete NDJSON reading with graceful corruption handling in `src/file-operations.ts`
- Atomic append operations with proper concurrency control in `src/atomic-append.ts`
- Cross-platform file locking system in `src/file-locking.ts`
- Sophisticated lock cleanup and stale lock management

**✅ Concurrency & Safety Features:**
- Advisory file locking with configurable timeouts
- Atomic write operations using temp-file-then-rename pattern
- Proper fsync for durability guarantees
- Idempotency checking to prevent duplicate events
- Comprehensive error handling for I/O failures

**✅ Advanced Capabilities:**
- Event deduplication with consecutive event optimization
- Directory creation and path management
- Crash-safe operations with partial line recovery
- Performance optimizations for high-throughput scenarios

**Key Implementation Files:**
- `src/file-operations.ts` - NDJSON reading with error recovery
- `src/atomic-append.ts` - Atomic write operations with locking
- `src/file-locking.ts` - Cross-platform advisory locking
- `src/optimization.ts` - Performance and deduplication utilities

**Production Ready:** This implementation exceeds the requirements with sophisticated concurrency control and error handling.
