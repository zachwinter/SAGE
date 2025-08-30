# Chronicle Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/chronicle` package.

## Overview

`@sage/chronicle` is SAGE's durable memory layer. It provides a simple, strongly-typed, **append-only** API for reading and writing `.sage` Chronicle files. Every material event in the ecology (approvals, denials, persona triggers, deployments, post-mortems) is recorded here for auditability and learning.

This contract specifies the expected behavior, interfaces, and guarantees that the Chronicle implementation must provide.

## Core Guarantees

### Append-Only

- No in-place mutation. All writes are additive.
- Corrections are emitted as new events that reference prior ones.
- File operations are atomic to ensure durability.

### Causal Links

- Events reference `planHash`, `graphCommit`, and optional `prevEventId` to build chains.
- Causal relationships between events are preserved and verifiable.

### Idempotency

- `eventId` (content hash) prevents duplicate appends.
- The same event appended multiple times will only appear once in the Chronicle.

### Ordering

- Events are timestamped with ISO 8601 timestamps.
- Monotonic timestamps ensure chronological ordering.
- File-level sequence numbers provide additional ordering guarantees.

### Concurrency Safety

- File locking around appends prevents race conditions.
- Cross-platform file locking with timeout handling.
- Atomic operations with crash safety.

### Tamper Evidence

- Events are canonical-JSON stringified with stable key order before hashing to `eventId`.
- `eventId` enables cryptographic verification of event integrity.
- Modifications to events will result in different hashes, making tampering detectable.

## Interface Specifications

### Main API Functions

The core Chronicle API provides functions for appending and reading events:

```typescript
export type ChroniclePath = string;

/**
 * Appends an event, automatically computing its eventId.
 * This is the standard, recommended method.
 */
export function appendEvent(
  path: ChroniclePath,
  evt: ChronicleEvent,
  lockTimeoutMs?: number
): Promise<void>;

/**
 * Appends an event using a pre-computed eventId.
 * For advanced use cases like event sourcing or testing.
 */
export function appendEventWithId(
  path: ChroniclePath,
  evt: ChronicleEvent, // Must contain a valid eventId
  lockTimeoutMs?: number
): Promise<void>;

export function readChronicle(path: ChroniclePath): Promise<ChronicleEvent[]>;

export function tailChronicle(
  path: ChroniclePath,
  n = 50
): Promise<ChronicleEvent[]>; // last n
```

### Event Model

All events share a minimal envelope and extend with type-specific payloads:

```typescript
export interface ChronicleEventBase {
  type: string; // e.g., "PLAN_APPROVED"
  eventId?: string; // sha256 of canonical JSON; computed if absent
  timestamp: string; // ISO 8601
  actor: { agent: string; id: string }; // e.g., {agent:"guardian", id:"src/Foo.ts"}
  planHash?: string; // if applicable
  graphCommit?: string; // commit index/hash anchoring to Code Graph
  prevEventId?: string; // causal link for corrections/amendments
  tags?: string[]; // freeform indexing
}
```

The Chronicle supports 13 distinct event types:
- `PLAN_DRAFTED`, `PLAN_APPROVED`, `PLAN_DENIED`, `PLAN_UNSAFE`
- `HALT_AND_REPORT`, `RECONCILIATION`, `ROGUE_EDIT_DETECTED`
- `BUILD`, `DEPLOY`, `ENVVAR_CHANGE`, `POSTMORTEM`
- `FILE_ADDED`, `FILE_REMOVED`, `FILE_RENAMED`

### Canonicalization & Hashing

- Events are canonical-JSON stringified with stable key order before hashing to `eventId`.
- SHA-256 is used for computing event hashes.
- The canonicalization process ensures deterministic hashes regardless of property order.

## Error Handling

The Chronicle implementation provides clear error messages for:

1. **Validation Errors** - Invalid event structures or missing required fields
2. **File System Errors** - Issues with reading or writing Chronicle files
3. **Concurrency Errors** - Lock acquisition timeouts or conflicts
4. **Canonicalization Errors** - Issues with JSON serialization or hashing

All errors follow SAGE's error handling conventions using typed errors from `@sage/utils`.

## Advanced Features

### Causal Chain Management

- Validation of causal chains between events
- Utilities for building and analyzing event chains
- Support for Merkle-style cryptographic chaining

### Chronicle Analysis and Repair

- Tools for analyzing Chronicle file integrity
- Utilities for repairing corrupted Chronicle files
- Duplicate event detection and removal

### Performance Optimizations

- Memory-efficient operations for large Chronicle files
- Batch operations for improved performance
- Indexing and caching for faster queries

## Future Extensions

This contract may be extended as Chronicle evolves to include:

- Additional event types as needed by the SAGE ecosystem
- Enhanced querying capabilities
- Integration with distributed storage systems
- Advanced analytics and reporting features