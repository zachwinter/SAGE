# @sage/chronicle - Implementation Context

## Package Purpose
Durable, append-only NDJSON event logs for agent memory with concurrency-safe operations.

## Contract Requirements (from CONTRACT.md)

### Core API
```ts
export type ChroniclePath = string; // "src/Foo.ts.sage" or ".sage/warden.prod.sage"

export interface AppendOptions {
  computeId?: boolean; // default true
  lockTimeoutMs?: number; // default 2000
}

export function appendEvent(path: ChroniclePath, evt: ChronicleEvent, opts?: AppendOptions): Promise<void>;
export function readChronicle(path: ChroniclePath): Promise<ChronicleEvent[]>;
export function tailChronicle(path: ChroniclePath, n?: number): Promise<ChronicleEvent[]>;
```

### Event Model
```ts
export interface ChronicleEventBase {
  type: string; // "PLAN_APPROVED", "ROGUE_EDIT_DETECTED", etc.
  eventId?: string; // SHA-256 hash of canonical JSON
  timestamp: string; // ISO8601
  actor: { agent: string; id: string };
  planHash?: string;
  graphCommit?: string;
  prevEventId?: string; // causal chaining
  tags?: string[];
}

// Union of all event types with specific payloads
export type ChronicleEvent = ChronicleEventBase & { /* event-specific fields */ };
```

## Key Requirements
- **Append-only**: Never modify existing lines
- **NDJSON format**: One JSON object per line
- **Concurrency-safe**: Advisory file locking during appends
- **Atomic writes**: fsync + temp-file-rename pattern
- **Idempotency**: Duplicate `eventId` handling
- **Crash safety**: Partial lines ignored on read

## Event Types (Complete Union)
- `PLAN_DRAFTED`, `PLAN_APPROVED`, `PLAN_DENIED`, `PLAN_UNSAFE`
- `HALT_AND_REPORT`, `RECONCILIATION`, `ROGUE_EDIT_DETECTED`
- `BUILD`, `DEPLOY`, `ENVVAR_CHANGE`, `POSTMORTEM`
- `FILE_ADDED`, `FILE_REMOVED`, `FILE_RENAMED`, `FILE_SPLIT`, `FILE_MERGED`

## Canonicalization & Hashing
- Use `@sage/utils` `canonicalJSONStringify()` for deterministic serialization
- Use `@sage/utils` `sha256()` for event ID computation
- Exclude `eventId` itself from hash computation
- Support `prevEventId` causal chaining

## Error Handling
- `ELOCK_TIMEOUT` when file lock cannot be acquired
- `EIO` for filesystem failures
- `EVALIDATION` for malformed events

## Dependencies
- `@sage/utils` for canonicalization, hashing, and typed errors