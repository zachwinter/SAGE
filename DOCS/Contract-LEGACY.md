# SAGE Package Contracts — Build‑From‑Blank Specs

> Goal: each package can be (re)implemented in isolation by a fresh team with **no access to other repos**, relying only on this document. This is a **contract‑first** spec: boundaries, types, behaviors, and acceptance tests.

## 📚 Quick Reference

- **[Type Reference](./docs/types/)** - Hyperlinked TypeScript definitions generated from this contract
- **[Normative Fixtures](./fixtures/)** - Concrete input/output pairs for bit-perfect compliance
- **[Zero-Knowledge Tests](./RELAY.md)** - Cross-package integration validation

**Monorepo assumptions**

- Language: TypeScript (ES2022), ESM only.
- Node: >= 20.10
- Package manager: pnpm
- Testing: Vitest
- Lint/format: eslint + prettier (not specified here; optional)
- Logging interface is abstract; concrete apps may provide adapters.

**Cross‑cutting conventions**

- All public APIs are **pure** and I/O free unless the interface explicitly includes an adapter.
- Time is injected via `Clock` (now(): ISO string). RNG via `Random` (seeded) when needed.
- File paths are POSIX‑style relative to a workspace root unless specified otherwise.
- Errors use a **typed error taxonomy** with `code` string and optional `cause`.
- JSON canonicalization uses stable key sort for hashing.

---

## @sage/utils (Foundations)

Minimal shared types and helpers used across packages. Zero runtime deps.

### Public Types

```ts
declare module "@sage/utils" {
  /**
   * ISO8601 timestamp string.
   * @example "2024-01-01T12:00:00.000Z"
   */
  export type ISO8601 = string;

  export interface Clock {
    /**
     * Returns current time as ISO8601 string.
     * @returns ISO8601 timestamp
     */
    now(): ISO8601;
  }

  export interface Random {
    /** Returns a random integer */
    int(): number;
    /** Returns a random float between 0 and 1 */
    float(): number;
  }

  export interface TypedError extends Error {
    /** Error classification code (EVALIDATION, EIO, etc.) */
    code: string;
    /** Optional underlying cause of the error */
    cause?: unknown;
  }

  /**
   * Create a typed error with standard structure.
   * @param code Error classification (EVALIDATION, EIO, etc.)
   * @param message Human-readable error message
   * @param cause Optional underlying cause
   */
  export function err(code: string, message: string, cause?: unknown): TypedError;

  /**
   * Convert object to canonical JSON string with stable key ordering.
   * Keys are sorted alphabetically at all nesting levels.
   * @example canonicalJSONStringify({c:3,a:1,b:[{y:2,x:1}]}) === '{"a":1,"b":[{"x":1,"y":2}],"c":3}'
   */
  export function canonicalJSONStringify(o: unknown): string;

  /**
   * Compute SHA-256 hash as lowercase hex string.
   * @param text Input string or bytes to hash
   * @returns Hex-encoded hash string
   * @example await sha256("hello") === "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
   */
  export function sha256(text: string | Uint8Array): Promise<string>;

  /**
   * An interface for a provider that can resolve secret values from a secure backend.
   * This is the core of the Vault-Warden Protocol.
   */
  export interface SecretProvider {
    /**
     * Fetches a secret value by its key.
     * @param key The identifier of the secret (e.g., "GITHUB_API_KEY").
     * @returns The secret value, or undefined if not found.
     */
    get(key: string): Promise<string | undefined>;
  }
}
```

### Acceptance

- `canonicalJSONStringify` must be stable across Node versions for object key order.
- `sha256` must match OpenSSL output.

---

## @sage/chronicle (Append‑Only Memory)

**Purpose:** durable, append‑only NDJSON logs per agent/file.

### Contracts

```ts
declare module "@sage/chronicle" {
  /**
   * A POSIX-style path relative to the workspace root, ending in `.sage`.
   * @example "src/Foo.ts.sage"
   * @example ".sage/warden.dev.sage"
   */
  export type ChroniclePath = string;

  export interface Actor {
    /** Agent archetype name (sage, guardian, warden, etc.) */
    agent: string;
    /** Unique identifier for this agent instance */
    id: string;
  }

  export interface ChronicleEventBase {
    /** Event type identifier (FUNCTION_ADDED, VALVE_PERSONA_TRIGGER, etc.) */
    type: string;
    /**
     * SHA-256 hash of the canonical JSON representation of the event.
     * Computed by the library if not provided.
     * @example "f25f2b4c8a7d3e9f..."
     */
    eventId?: string;
    /**
     * Event timestamp in ISO8601 format.
     * @example "2024-01-01T12:00:00.000Z"
     */
    timestamp: string;
    /** The agent that created this event */
    actor: Actor;
    /**
     * Hash of the plan that triggered this event.
     * @example "abc123def456"
     */
    planHash?: string;
    /**
     * Commit hash in the graph database when this event occurred.
     * @example "commit-789"
     */
    graphCommit?: string;
    /**
     * Hash of the previous event for chain integrity.
     * @example "e3b0c44298fc1c14..."
     */
    prevEventId?: string;
    /**
     * Categorization tags for filtering and analysis.
     * @example ["refactor", "typescript"]
     */
    tags?: string[];
  }

  export type ChronicleEvent = ChronicleEventBase & Record<string, unknown>;

  // Example of a specific event type
  export type ValvePersonaTriggerEvent = ChronicleEventBase & {
    type: "VALVE_PERSONA_TRIGGER";
    persona: string; // "Guardian", "TypeNazi", etc.
    filePath: string;
    trigger: {
      type: "filter" | "content_pattern";
      details: string; // The glob pattern or regex that matched
    };
    context?: string; // e.g., a snippet of the matching line
  };

  /**
   * Appends an event to a Chronicle, automatically computing its eventId.
   * This is the standard and recommended method for appending events.
   * @param path The path to the Chronicle file.
   * @param evt The event to append.
   * @param lockTimeoutMs The timeout for acquiring a file lock.
   */
  export function appendEvent(
    path: ChroniclePath,
    evt: ChronicleEvent,
    lockTimeoutMs?: number
  ): Promise<void>;

  /**
   * Appends an event to a Chronicle using a pre-computed eventId.
   * This is an advanced method for use cases like event sourcing or testing.
   * @param path The path to the Chronicle file.
   * @param evt The event to append. Must include a valid eventId.
   * @param lockTimeoutMs The timeout for acquiring a file lock.
   */
  export function appendEventWithId(
    path: ChroniclePath,
    evt: ChronicleEvent,
    lockTimeoutMs?: number
  ): Promise<void>;
  export function readChronicle(path: ChroniclePath): Promise<ChronicleEvent[]>;
  export function tailChronicle(
    path: ChroniclePath,
    n?: number
  ): Promise<ChronicleEvent[]>;
}
```

### Behavioral Rules

- **Append‑only**: never modify existing lines. Partial lines are ignored on read.
- **Idempotency**: when `computeId` is true, identical canonical payloads yield the same `eventId`; duplicate appends are allowed but must not produce duplicate lines if identical `eventId` exists **consecutively** (implementations may dedupe or just allow duplicates; CLI consumers handle it).
- **Locking**: per‑file advisory lock around append; fail with `ELOCK_TIMEOUT`.

### Error Codes

- `ELOCK_TIMEOUT`, `EIO`, `EVALIDATION`

### Acceptance

- Simulated concurrent appends produce a linearized order (no interleaving bytes).
- Events round‑trip: `append` then `read` yields the same objects (ignoring computed `eventId`).

---

## @sage/graph (Commit‑Addressable Code Graph)

**Purpose:** Kùzu‑backed or in‑memory graph of code facts with MVCC fields.

### Contracts

```ts
declare module "@sage/graph" {
  export interface IngestOptions {
    projectPath: string;
    commitHash: string;
  }
  export interface QueryOptions {
    query: string;
    params?: Record<string, any>;
    commit?: string;
  }
  export interface QueryResult<T = any> {
    results: T[];
    error?: Error;
  }

  export function ingestProject(opts: IngestOptions): Promise<void>;
  export function queryGraph<T = any>(opts: QueryOptions): Promise<QueryResult<T>>;
}
```

### Schema (required labels/edges)

Nodes carry `{ first_seen: number; last_seen: number; }` indexes referencing a commit table.

- `(:File { path, name, first_seen, last_seen })`
- `(:Function { name, first_seen, last_seen })`
- `(:Class { name, first_seen, last_seen })`
- `(:Variable { name, first_seen, last_seen })`
- Edges: `IMPORTS`, `DEFINES_FUNCTION`, `HAS_METHOD`, `CALLS`, `WAS_RENAMED_FROM`

### Behavioral Rules

- `ingestProject` must be **idempotent per (projectPath, commitHash)**.
- Later ingests must set `last_seen` for removed facts.
- `queryGraph` must accept a `/* @commit: HASH */` hint inside `query` **or** `commit` option; option wins.

### Acceptance

- Ingest two commits where a function is added then removed; queries at each commit reflect presence/absence.
- File rename produces `WAS_RENAMED_FROM` chain.

---

## @sage/graph (AST → facts seed)

**Purpose:** Discovery of TS/JS files and extraction of entities/relations. Intended to be the predecessor of `graph` but still shippable standalone.

### Contracts

```ts
declare module "@sage/graph" {
  export interface AnalyzeOptions {
    projectPath: string;
    include?: string[];
    exclude?: string[];
  }
  export interface Entity {
    kind: "file" | "function" | "class" | "variable";
    name: string;
    file: string;
  }
  export interface Relation {
    kind: "imports" | "defines" | "hasMethod" | "calls";
    from: string;
    to: string;
    meta?: any;
  }
  export interface Analysis {
    entities: Entity[];
    relations: Relation[];
  }

  export function analyzeProject(opts: AnalyzeOptions): Promise<Analysis>;
  export function exportAsJSON(a: Analysis): string; // deterministic order
}
```

### Acceptance

- Deterministic output order (alpha path, then entity kind/name).
- Supports JS/TS, ESM/CJS import syntax minimally.

---

## @sage/tools (Sandboxed Capabilities)

**Purpose:** Narrow, auditable actions. Registry resolves tools by name; tools validate inputs via JSON Schema and/or Zod.

### Contracts

```ts
declare module "@sage/tools" {
  export interface ToolContext {
    cwd: string;
    env?: Record<string, string>;
    dryRun?: boolean;
    permissions?: string[];
    logger?: (e: ToolLog) => void;
    /**
     * An optional secret provider for just-in-time value injection.
     * If provided, the tool runner is responsible for placeholder substitution.
     */
    secretProvider?: import("@sage/utils").SecretProvider;
  }
  export interface ToolLog {
    ts: string;
    name: string;
    msg: string;
    data?: any;
  }

  export interface Tool<I = any, O = any> {
    name: string;
    description?: string;
    schema: Record<string, any>;
    validate(input: unknown): I;
    execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
    version?: string;
  }
  export interface ToolResult<T> {
    ok: boolean;
    data?: T;
    error?: { code: string; message: string };
    meta?: { startedAt: string; endedAt: string; durationMs: number };
  }

  export interface ToolRegistry {
    register<TI, TO>(tool: Tool<TI, TO>): void;
    get<TI, TO>(name: string): Tool<TI, TO>;
    getToolSchemas(): { name: string; parameters: any; description?: string }[];
  }

  export const toolRegistry: ToolRegistry;
}
```

### Standard Tools (normative behavior)

- **GraphQuery** (read‑only): `{ query: string; params?: object; commit?: string }` → `{ rows: any[] }`
- **Read**: `{ file: string }` → `{ content: string }`
- **Write**: `{ file: string; content: string }` → `{ bytes: number }`
- **Edit**: `{ file: string; patch: string; strategy?: "apply"|"check" }` → `{ patched: boolean; diff?: string }`
- **Bash**: `{ command: string; args?: string[]; timeoutMs?: number }` → `{ code: number; stdout: string; stderr: string }`

### Policies

- Default allow: `GraphQuery`, `Read`
- Default confirm/deny without explicit permission: `Write`, `Edit`, `Bash`
- Path policy: writes must not escape workspace; `.sage/` protected except via Chronicle adapters.

### Behavioral Rules (Secret Injection)

- **Secret Injection:** If a `secretProvider` is present in the `ToolContext`, the tool execution runtime MUST recursively scan all string-based inputs for placeholders of the format `$ENV.SECRET_NAME`.
- **Just-in-Time Resolution:** For each placeholder found, the runtime MUST call `secretProvider.get("SECRET_NAME")` to fetch the value. The placeholder in the input string MUST be replaced with the fetched value before the tool's `execute` method is called.
- **Failure on Missing Secret:** If a placeholder is found but the `secretProvider` returns `undefined` or throws an error, the tool execution MUST fail with an `EPERMISSION` or a new `ESECRET_NOT_FOUND` error code.
- **Redaction:** The tool execution runtime MUST take reasonable steps to prevent the resolved secret value from appearing in any returned `stdout`, `stderr`, logs, or `ToolResult` data. It can be replaced with a redacted placeholder like `[SECRET:GITHUB_API_KEY]`.

### Acceptance

- JSON Schema validation rejects extra properties by default.
- `dryRun` on mutating tools returns deterministic, non‑mutating previews.

---

## @sage/llm (Provider‑Agnostic LLM)

**Purpose:** Single interface for chat + tool‑use + streaming.

### Contracts

```ts
declare module "@sage/llm" {
  export type Role = "system" | "user" | "assistant" | "tool";
  export interface ChatMessage {
    role: Role;
    content: string;
    tool_call_id?: string;
  }
  export interface ToolSchema {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }
  export interface ChatOptions {
    model: string;
    messages: ChatMessage[];
    tools?: ToolSchema[];
    temperature?: number;
    max_tokens?: number;
    timeoutMs?: number;
    requestId?: string;
  }
  export type StreamEvent =
    | { type: "text"; value: string }
    | { type: "tool_call"; toolName: string; arguments: unknown; callId: string }
    | { type: "tool_result"; callId: string; result: unknown }
    | { type: "end"; usage?: { prompt: number; completion: number } };

  export interface LLMProvider {
    name: string;
    chat(opts: ChatOptions): AsyncIterable<StreamEvent> | Promise<{ text: string }>;
    models(): Promise<{ name: string }[]>;
  }

  export function setProvider(p: LLMProvider): void;
  export function listModels(providerName?: string): Promise<{ name: string }[]>;
  export function createChatStream(
    opts: ChatOptions
  ): Promise<AsyncIterable<StreamEvent>>;
}
```

### Behavioral Rules

- If provider cannot stream, wrapper yields `text` chunks synthesized from final text.
- Tool args must be validated against `tools[].parameters`; on failure emit an error event **instead of** executing.
- Prompt cache is optional; if implemented, must key on `(model,messages,tools,temperature,max_tokens)` with canonical JSON.

### Acceptance

- Deterministic replay with seeded fake provider (see `@sage/test-utils`).
- Proper pairing of `tool_call` → `tool_result` by `callId`.

---

## @sage/aql (Declarative Orchestrator)

**Purpose:** Parse → type‑check → plan → execute declarative workflows over `llm` + `tools`, optional `agents` review.

### Contracts (surface)

```ts
declare module "@sage/aql" {
  export interface CompileOptions {
    variables?: Record<string, any>;
  }
  export interface Plan {
    dag: Node[];
    outputs: Record<string, string>;
    meta?: any;
  }

  export function compile(source: string, opts?: CompileOptions): Promise<Plan>;
  export function execute(
    plan: Plan,
    runtime: {
      tools: import("@sage/tools").ToolRegistry;
      onEvent?: (e: { type: string; [k: string]: any }) => void;
    }
  ): Promise<{ outputs: Record<string, any> }>;
}
```

### Minimal Syntax (normative subset)

- `query Name($var: Type!) { step1: agent(model: "foo") { prompt: "...{{var}}..." } final: merge(step1) }`
- `parallel { a: agent(...); b: agent(...) }`
- Variables scope and step outputs are strings unless a `tool` step is declared.

### Acceptance

- Parser must reject unknown top‑level fields; whitespace‑agnostic.
- Planner produces DAG with explicit deps; `parallel` islands execute concurrently.

---

## @sage/agents (Society of Minds)

**Purpose:** Executable protocols and state machines.

### Contracts

```ts
declare module "@sage/agents" {
  // External adapters
  export interface GraphAdapter {
    query<T>(cypher: string, params?: Record<string, unknown>): Promise<T[]>
  }
  export interface ChronicleAdapter {
    read(path: string): Promise<any[]>;
    append(path: string, evt: any): Promise<void>
  }
  export interface LLMClient {
    createChatStream(opts: import("@sage/llm").ChatOptions): Promise<AsyncIterable<import("@sage/llm").StreamEvent>>
  }
  export interface ToolRegistry extends import("@sage/tools").ToolRegistry {}

  // Types
  export interface Plan { id: string; summary: string; steps: any[] }
  export type Approve = { type: "approve"; justification: string };
  export type Deny = { type: "deny"; reason: string };

  export interface IGuardian {
    reviewPlan(plan: Plan): Promise<Approve | Deny>;
    reconcile(edit: { filePath: string; diffRef: string }): Promise<{ ok: boolean }>;
    selfInquiry(): Promise<{ findings: string[] }>;
    bulletWoundCheck(assertions: { cypher: string; expectRows: boolean }[]): Promise<void>; // may throw HALT
  }
  export interface IDelegator { execute(plan: Plan): Promise<{ ok: boolean; report: any }> }
  export interface IWarden { reviewPlan(plan: Plan): Promise<Approve|Deny> }
  export interface ISage {
    ideate(input: { goal: string }): Promise<{ options: string[] }>;
    draftPlan(ideation: { options: string[] }): Promise<Plan>;
    mediate(reviews: { guardian: (Approve|Deny)[]; warden?: (Approve|Deny)[] }): Promise<{ decision: Approve|Deny }>;
  }

  // Reference classes may be exported but not required by contract
}
```

### Behavioral Rules

- **Bullet Wound Invariant**: `bulletWoundCheck` must throw `HALT_AND_REPORT` when contradictions are detected; caller must be able to catch and log.
- **Reconciliation**: `reconcile` must append a Chronicle event with `RECONCILIATION`.
- **Determinism**: Agents do not perform I/O except through adapters.

### Adapter Behavioral Requirements

**GraphAdapter implementations must:**

- **Handle connection management**: Pooling, retries, and connection lifecycle are the adapter's responsibility
- **Return empty arrays for missing data**: A query for non-existent entities should return `[]`, NOT throw a 'NotFound' error
- **Be injection-safe**: Parameterization via the `params` argument must be supported; adapters should be resilient to basic Cypher injection
- **Respect commit context**: When `query` includes `/* @commit: HASH */` hint, results must be scoped to that commit's view
- **Maintain transaction boundaries**: Multiple queries in rapid succession should not interfere with each other

**ChronicleAdapter implementations must:**

- **Preserve append-only semantics**: Never modify existing entries; only append new events
- **Handle concurrent access**: Multiple agents appending simultaneously must not corrupt the chronicle
- **Maintain event ordering**: Events must appear in the chronicle in the order they were successfully appended
- **Validate event structure**: Malformed events should be rejected with `EVALIDATION` before any I/O

**LLMClient implementations must:**

- **Stream consistently**: If streaming is not supported, synthesize text chunks from final response
- **Validate tool calls**: Tool arguments must match declared schemas; invalid calls should emit error events instead of executing
- **Handle timeouts gracefully**: Respect `timeoutMs` option and clean up resources on timeout
- **Maintain call-result pairing**: Each `tool_call` event must have a corresponding `tool_result` with matching `callId`

### Acceptance

- Guardian denies a plan that violates a provided graph assertion; Delegator must not execute.
- Warden approval gates a production promotion (mocked).

---

## @sage/ui (Renderer‑Agnostic Primitives)

**Purpose:** One component model; adapters for CLI (Ink) and Web (DOM).

### Contracts (headless)

```tsx
declare module "@sage/ui" {
  export type Align = "start"|"center"|"end";
  export interface TextProps { variant?: "title"|"subtitle"|"body"|"mono"; dim?: boolean; bold?: boolean; wrap?: boolean; children?: any }
  export interface RowProps { gap?: number; align?: Align; justify?: Align; children?: any }
  export interface ColumnProps { gap?: number; align?: Align; justify?: Align; children?: any }
  export interface BoxProps { padding?: number; margin?: number; border?: boolean; rounded?: boolean; children?: any }

  export const Text: (p: TextProps) => any;
  export const Row: (p: RowProps) => any;
  export const Column: (p: ColumnProps) => any;
  export const Box: (p: BoxProps) => any;

  export interface StreamEvent extends import("@sage/llm").StreamEvent {}
  export const Chat: (props: { stream: AsyncIterable<StreamEvent>; children?: any }) => any;
  export const AssistantTurn: (props?: Record<string, any>) => any;
  export const UserMessage: (props: { children?: any }) => any;
}
```

### Acceptance

- Renderers (cli/web) must share prop semantics; snapshot tests verify parity on simple trees.
- `<Chat>` consumes an async iterable and renders incremental text.

---

## apps/cli (Orchestrator App)

**Purpose:** Human ↔ society interface. Minimal orchestration; all deep logic lives in packages.

### Commands (normative)

- `sage ingest` → calls `@sage/graph` (or `@sage/graph.ingestProject`) and reports counts.
- `sage ask <prompt>` → starts a chat stream via `@sage/llm`, default tool policy from `@sage/tools`.
- `sage analyze` → runs analysis and prints JSON summary.
- `sage version` → prints package versions detected.

### Contracts

- Uses `@sage/ui` primitives only; no direct Ink/DOM in app code.
- Tool approval policy: read‑only auto, mutating asks confirmation unless `--yes`.

### Acceptance

- Golden snapshots for streaming UI and tool call renders using `@sage/test-utils` fake providers.

---

## apps/valve (The Perceptual Valve)

**Purpose:** Configurable perceptual apparatus.

### Contracts

```ts
interface ValveOptions {
  pollMs?: number;
  clock?: import("@sage/utils").Clock;
}
function startValve(
  configPath: string,
  options: ValveOptions
): { stop(): Promise<void> };
```

- On detected FS change that matches a Persona's filter, append a `VALVE_PERSONA_TRIGGER` event to the target file's Chronicle via `@sage/chronicle`.
- On startup, perform backfill since last run (persist minimal `lastSeen` map).
- **Never reads** Chronicles or Graph; no LLM.

### Acceptance

- Stop/start with simulated downtime emits events for missed writes.
- A change matching a persona filter in `valve.yml` correctly generates a `VALVE_PERSONA_TRIGGER` event.

---

## @sage/test-utils (Deterministic Harness)

**Purpose:** Temp FS, in‑memory adapters, seeded LLM, CLI/Daemon simulators, matchers.

### Contracts (surface)

```ts
declare module "@sage/test-utils" {
  export function createTempWorkspace(opts?: {
    prefix?: string;
    clock?: import("@sage/utils").Clock;
  }): Promise<
    { root: string } & {
      file(p: string, content: string): Promise<void>;
      read(p: string): Promise<string>;
      tree(): Promise<Record<string, string>>;
    }
  >;

  export function makeGraphAdapter(): import("@sage/agents").GraphAdapter;
  export function makeChronicle(): {
    append: (p: string, e: any) => Promise<void>;
    read: (p: string) => Promise<any[]>;
  };
  export function makeLLM(opts?: {
    seed?: number;
    tools?: Record<string, (i: any) => Promise<any>>;
  }): import("@sage/agents").LLMClient;
  export function makeTools(opts?: {
    readOnly?: boolean;
  }): import("@sage/tools").ToolRegistry;

  export function golden(ws: { root: string }, path: string): Promise<void>;
}
```

### Acceptance

- All adapters are pure in‑memory and deterministic for CI.

---

## @sage/mcp (Legacy Shim)

- Non‑normative. If present, it **must** adapt to `@sage/llm` provider interface (`LMStudioProvider`). No other consumers depend on it.

---

# Error Taxonomy (Global)

All errors follow the `TypedError` interface with specific additional properties per error code:

```ts
// Base error interface (from @sage/utils)
export interface TypedError extends Error {
  code: string;
  cause?: unknown;
  [key: string]: any; // Allow for additional properties
}
```

## Error Code Specifications

### `EVALIDATION` - Schema/argument failures

Expected additional properties:

```ts
{
  details: Array<{
    field: string; // Name of the invalid field
    reason: string; // Why it failed validation
    received?: any; // What value was actually received
    expected?: any; // What value/type was expected
  }>;
}
```

### `EPERMISSION` - Denied by path/policy

Expected additional properties:

```ts
{
  resource: string;    // Path or resource that was denied
  operation: string;   // What operation was attempted (read, write, execute)
  policy?: string;     // Which policy rule was violated
}
```

### `ETIMEOUT` - Tool or provider timeout

Expected additional properties:

```ts
{
  timeoutMs: number; // Configured timeout in milliseconds
  elapsedMs: number; // How long the operation actually ran
  operation: string; // What operation timed out
}
```

### `EIO` - Filesystem/database/network failure

Expected additional properties:

```ts
{
  path?: string;       // File/network path involved (if applicable)
  operation: string;   // What I/O operation failed (read, write, connect)
  code?: string;       // System error code (ENOENT, EACCES, etc.)
}
```

### `ELOCK_TIMEOUT` - Chronicle file lock contention

Expected additional properties:

```ts
{
  path: string;        // Path to the chronicle file that couldn't be locked
  timeoutMs: number;   // How long we waited for the lock
  holder?: string;     // Process/agent that currently holds the lock (if known)
}
```

### `EHALT` - Bullet Wound Invariant triggered (agents)

Expected additional properties:

```ts
{
  invariant: string;   // Description of which invariant was violated
  expected: any;       // What the invariant expected to find
  actual: any;         // What was actually found
  context?: {          // Additional context about the violation
    graphCommit?: string;
    chroniclePath?: string;
    [key: string]: any;
  };
}
```

## Usage Example

```ts
// Creating a validation error
const validationError: TypedError = {
  name: "ValidationError",
  message: "Invalid function name format",
  code: "EVALIDATION",
  details: [
    {
      field: "functionName",
      reason: "Must contain only alphanumeric characters",
      received: "my-function-name",
      expected: "myFunctionName"
    }
  ]
};

// Creating a lock timeout error
const lockError: TypedError = {
  name: "LockTimeoutError",
  message: "Could not acquire chronicle file lock",
  code: "ELOCK_TIMEOUT",
  path: "src/utils/math.ts.sage",
  timeoutMs: 2000,
  holder: "daemon-watcher-123"
};
```

---

# Reference Interactions (Narrative Tests)

1. **Plan Rejected by Guardian**

- Setup: graph asserts `Function A must exist in src/A.ts`.
- Draft plan to remove `A`.
- Guardian `reviewPlan` → `deny` with reason.
- Delegator receives `deny`; no tools are executed; chronicle appends `PLAN_DENIED`.

2. **Transaction Boundary**

- Delegator compiles an approved plan into AQL with `Edit`+`Write` steps.
- Engine runs in staging; validators pass → atomic commit; else no mutation.

3. **Persona Trigger & Reconciliation**

- Valve writes `VALVE_PERSONA_TRIGGER`.
- Guardian `reconcile` records `RECONCILIATION` with `diffRef`.

4. **Unsafe Protocol**

- Denied plan is forced by user; `PLAN_UNSAFE` stamped and cross‑linked in subsequent events.

---

# Build‑From‑Blank Checklist (per package)

- ✅ Public Types & Functions exported
- ✅ Behavioral rules & invariants
- ✅ Error codes
- ✅ Minimal acceptance tests
- ✅ Determinism requirements
- ✅ Adapter boundaries

---

# Notes for Implementors

- You are free to choose internal structure (classes vs functions) **as long as** you satisfy the contracts and acceptance suites.
- Where hashing/canonicalization is used (Chronicle IDs, prompt caches), your outputs must match the provided fixtures bit‑for‑bit.
- If you add optional features (e.g., cache), protect them behind flags; default behavior must remain normative and portable.
