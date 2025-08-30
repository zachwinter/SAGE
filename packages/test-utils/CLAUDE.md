# @sage/test-utils - Implementation Context

## Package Purpose
Fast, isolated, reproducible testing utilities with temp FS, in-memory adapters, and protocol-specific matchers for SAGE.

## Contract Requirements (from CONTRACT.md)

### Core API
```ts
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
```

## Key Features

### Temp FS & Workspaces
- Isolated filesystem per test with auto-cleanup
- Path guards (no writes outside workspace)  
- Pretty diff rendering for file/directory comparison
- Golden snapshot testing support

### In-Memory Adapters
- **Graph**: MVCC-lite with commit indices, minimal Cypher surface
- **Chronicle**: Append-only with idempotent eventId handling
- **LLM**: Deterministic token streams with seeded randomness
- **Tools**: Read/Write/Edit/Bash fakes with quotas/timeouts

### Agent Scenario DSL
```ts
const sc = await scenario()
  .withWorkspace(ws => ws.file("src/A.ts", "export const A=1\n"))
  .withGraph()
  .withChronicle()
  .withLLM({ seed: 7 })
  .withTools({ readOnly: false })
  .withGuardian("src/A.ts")
  .withDelegator();

const plan = await sc.sageDraftPlan({ goal: "rename A→Answer" });
const review = await sc.guardian("src/A.ts").reviewPlan(plan);
```

### Protocol-Specific Matchers
- `toEqualDir(expectedStructure)` - deep compare workspace trees
- `toContainEvent(eventLike)` - Chronicle includes matching event
- `toBeCommitAddressable()` - Graph nodes have required commit fields
- `toRespectTransactionBoundary()` - no staging escapes before success

## Determinism Requirements
- **Clocks**: Fixed timestamps via injected Clock interface
- **RNG**: Seeded randomness for consistent LLM outputs  
- **I/O**: Hermetic operations, no external network/filesystem
- **Concurrency**: Deterministic async execution ordering

## Testing Patterns
- **Transaction Boundary**: Delegator staging → validation → atomic commit
- **Bullet Wound**: Graph/Chronicle contradiction → HALT_AND_REPORT
- **Unsafe Protocol**: Denied plan override → PLAN_UNSAFE stamping
- **Reconciliation**: Daemon event → Guardian dialogue → Chronicle append

## CLI & Daemon Simulators
```ts
export function runCLI(args: string[], opts?: {
  env?: Record<string, string>;
  clock?: Clock;
}): Promise<{ exitCode: number; stdout: string; ui: any }>;

export function makeDaemon(opts?: {
  clock?: Clock;
  chronicle?: ChronicleAdapter;
}): { emit(event: any): void; runOnce(): Promise<void> };
```

## Dependencies
- `@sage/utils` for Clock/Random interfaces and deterministic operations
- All SAGE packages (as dev dependencies for adapter compliance)
- Vitest/Jest for test framework integration