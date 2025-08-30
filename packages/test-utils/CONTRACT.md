# Test Utils Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/test-utils` package.

## Overview

`@sage/test-utils` provides batteries-included utilities for **fast, isolated, reproducible** tests across the SAGE monorepo. It ships temp-FS harnesses, in-memory adapters for Graph/Chronicle/LLM/Tools, deterministic clocks & RNG, CLI and Daemon simulators, and assertion helpers tailored to SAGE's **Principles & Protocols**.

This contract specifies the expected behavior, interfaces, and guarantees that the test-utils implementation must provide.

## Core Guarantees

### Determinism by Default

- Stable clocks with fixed time sources
- Seeded RNG for reproducible randomization
- Hermetic IO with no external dependencies
- Consistent behavior across multiple test runs

### Speed

- No disk/network unless explicitly enabled
- Everything has an in-memory variant
- Optimized for fast test execution
- Minimal overhead for test setup and teardown

### Ergonomics

- Minimal boilerplate to stand up agents/flows
- Good defaults for common test scenarios
- Intuitive APIs with clear method signatures
- Comprehensive documentation and examples

### Auditability

- Golden snapshots for Chronicles, ExecutionReports, and Graph diffs
- Clear diff output for test failures
- Deterministic snapshot content with sorted keys
- Stable timestamps and consistent formatting

## Interface Specifications

### Temp FS & Workspace Harnesses

```typescript
export interface TempWorkspace {
  root: string;
  file(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  tree(): Promise<Record<string, string>>;
  cleanup(): Promise<void>;
}

/**
 * Create a temporary workspace for testing
 */
export async function createTempWorkspace(options?: {
  prefix?: string;
  clock?: Clock;
}): Promise<TempWorkspace>;

/**
 * Write a file to a temporary workspace
 */
export async function writeFile(
  workspace: TempWorkspace,
  path: string,
  content: string
): Promise<void>;

/**
 * Read a file from a temporary workspace
 */
export async function readFile(
  workspace: TempWorkspace,
  path: string
): Promise<string>;

/**
 * Compare directory structure and contents
 */
export async function expectDirEquals(
  workspace: TempWorkspace,
  expected: Record<string, string>
): Promise<void>;

/**
 * Create a golden snapshot for comparison
 */
export async function golden(
  workspace: TempWorkspace,
  path: string
): Promise<void>;
```

### In-Memory Adapters

#### Graph Adapter (MVCC-lite)

```typescript
export interface GraphAdapter {
  ingest(options: {
    file: string;
    defines: string[];
    commit: string;
  }): Promise<void>;
  
  query<T>(
    cypher: string,
    params: Record<string, any>,
    options?: {
      commit?: string;
    }
  ): Promise<T[]>;
}

/**
 * Create an in-memory Graph adapter
 */
export function makeGraphAdapter(): GraphAdapter;
```

#### Chronicle Adapter (Append-Only)

```typescript
export interface ChronicleAdapter {
  append(
    path: string,
    event: ChronicleEvent
  ): Promise<void>;
  
  read(path: string): Promise<ChronicleEvent[]>;
  
  tail(
    path: string,
    n?: number
  ): Promise<ChronicleEvent[]>;
}

/**
 * Create an in-memory Chronicle adapter
 */
export function makeChronicle(): ChronicleAdapter;
```

#### LLM Adapter (Deterministic)

```typescript
export interface LLMClient {
  chat(options: ChatOptions): AsyncIterable<StreamEvent>;
}

/**
 * Create a deterministic LLM adapter
 */
export function makeLLM(options?: {
  seed?: number;
  tools?: Record<string, ToolExecutor>;
}): LLMClient;
```

#### Tools Adapter (Sandboxed Fakes)

```typescript
export interface ToolRegistry {
  get(name: string): Tool;
  register(tool: Tool): void;
  execute(name: string, input: any, context: ToolContext): Promise<any>;
}

/**
 * Create a tools adapter
 */
export function makeTools(options?: {
  readOnly?: boolean;
}): ToolRegistry;
```

### Agent Scenario DSL & Harnesses

```typescript
export interface Scenario {
  withWorkspace(
    setup: (ws: TempWorkspace) => Promise<void>
  ): Scenario;
  
  withGraph(): Scenario;
  
  withChronicle(): Scenario;
  
  withLLM(options?: {
    seed?: number;
  }): Scenario;
  
  withTools(options?: {
    readOnly?: boolean;
  }): Scenario;
  
  withGuardian(filePath: string): Scenario;
  
  withDelegator(): Scenario;
  
  sageDraftPlan(options: {
    goal: string;
  }): Promise<Plan>;
  
  guardian(filePath: string): Agent;
  
  delegator(): Agent;
  
  expectChronicle(path: string): ChronicleExpectation;
  
  expectGraph(query: string, params: any): GraphExpectation;
  
  flushDaemons(): Promise<void>;
}

export interface ChronicleExpectation {
  toContainEvent(event: Partial<ChronicleEvent>): Promise<void>;
}

export interface GraphExpectation {
  toReturn(rows: any[]): Promise<void>;
}

/**
 * Create a test scenario
 */
export async function scenario(): Promise<Scenario>;
```

### Protocol Matchers & Assertions

```typescript
export interface DirectoryMatcher {
  toEqualDir(expected: Record<string, string>): Promise<void>;
}

export interface ChronicleEventMatcher {
  toContainEvent(event: Partial<ChronicleEvent>): Promise<void>;
}

export interface GraphNodeMatcher {
  toBeCommitAddressable(): Promise<void>;
}

export interface TransactionMatcher {
  toRespectTransactionBoundary(): Promise<void>;
}

/**
 * Setup custom matchers for Vitest/Jest
 */
export function setupMatchers(): void;
```

## Temp FS & Workspace Harnesses

### Isolated Filesystem Testing

- Each test runs in a completely isolated temporary filesystem
- Unique temporary directories with configurable prefixes
- Automatic cleanup on test completion (success or failure)
- Path guards preventing writes outside workspace boundaries

### File Operations API

- `workspace.file(path, content)` for creating files
- `workspace.read(path)` for reading file contents
- `workspace.tree()` for getting complete directory structure
- Path validation and normalization utilities

### Directory Comparison & Diffing

- `expectDirEquals(workspace, expectedStructure)` matcher
- Pretty-printed diffs for directory structure mismatches
- File content comparison with unified diff output
- Handle binary files and large files gracefully

### Golden Snapshot Testing

- `golden(workspace, path)` saves/compares against snapshots
- Store snapshots in `__snapshots__/` directory next to tests
- Automatic snapshot creation in record mode
- Deterministic snapshot content (sorted keys, stable timestamps)

### Test Framework Integration

- Vitest/Jest integration with proper lifecycle hooks
- Automatic cleanup on test completion (success or failure)
- Concurrent test isolation (unique temp dirs)
- Memory leak prevention and resource cleanup

## In-Memory Adapters

### Graph Adapter (MVCC-lite)

- In-memory graph storage with commit tracking
- `first_seen`/`last_seen` indices for versioning
- Basic Cypher query resolver for common patterns
- Support for MATCH, WHERE, RETURN with simple node/edge patterns
- Commit-aware query filtering

### Chronicle Adapter (Append-Only)

- In-memory event storage with append-only semantics
- Event ID computation using canonical JSON hashing
- Idempotent append handling (skip duplicates)
- Time-ordered reads and tailing helpers
- Proper event validation

### LLM Adapter (Deterministic)

- Seeded token generation for reproducible outputs
- Tool call emission based on configured tool schemas
- Configurable response patterns and tool behaviors
- Usage tracking and streaming event synthesis
- Deterministic behavior across multiple runs

### Tools Adapter (Sandboxed Fakes)

- Fake implementations of Read, Write, Edit, Bash tools
- Configurable quotas, timeouts, and permission policies
- Dry-run mode support for mutation preview
- Execution tracking and result validation
- Error injection capabilities for failure testing

## Agent Scenario DSL & Harnesses

### End-to-End Agent Testing

- Stand up complete Plan/Approve/Delegate flows in one place
- Compose workspace, graph, chronicle, LLM, and tools in one setup
- Agent harnesses for Guardian and Delegator testing
- Scenario DSL for readable test definitions

### Agent Interaction Helpers

- `sc.sageDraftPlan({ goal })` to create plans
- `sc.guardian(filePath).reviewPlan(plan)` to review plans
- `sc.delegator.execute(plan)` to execute plans
- Assertion helpers for validating outcomes

### Expectation Helpers

- `sc.expectChronicle(path).toContainEvent(match)` for chronicle validation
- `sc.expectGraph(query, params).toReturn(rows)` for graph validation
- `sc.flushDaemons()` to deliver pending filesystem events

## Protocol Matchers & Assertions

### Custom Test Matchers

- `toEqualDir(expectedStructure)` for directory comparison
- `toContainEvent(eventLike)` for chronicle event matching
- `toBeCommitAddressable()` for graph node validation
- `toRespectTransactionBoundary()` for transaction validation

### Matcher Registration

- Automatic registration with Vitest/Jest
- Clear error messages with diff output
- Type-safe matcher implementations
- Integration with test framework reporting

## Clocks, RNG, and Time

### Deterministic Time Management

- `fixed(timestamp)` for frozen time sources
- `advance(clock, duration)` for time progression
- Integration with temp workspace creation
- Consistent timestamps across test runs

### Seeded Random Number Generation

- `withSeed(seed)` for reproducible randomness
- Integration with LLM token generation
- Consistent random sequences across runs
- Support for multiple RNG instances

## Error Handling

### Test Failure Reporting

- Clear error messages with context
- Pretty-printed diffs for comparison failures
- Stack traces with relevant source information
- Integration with test framework error reporting

### Resource Management

- Automatic cleanup of temporary files and directories
- Memory leak prevention through proper disposal
- Resource usage monitoring and limits
- Graceful handling of cleanup failures

## Advanced Features

### CLI Runner & Transcript Capture

- CLI runner (Ink) with transcript capture
- Mocks MCP/LLM providers for deterministic testing
- Captures streaming output deterministically
- UI matchers for `<Chat>` and tool-call renders

### Daemon Simulator

- Daemon event simulator & outage windows
- Emits `ROGUE_EDIT_DETECTED`, outage windows, and backfill passes
- Useful for Reconciliation & Bullet Wound scenarios
- Integration with chronicle and graph adapters

### CI Guidance

- Run unit tests with `--runInBand` for deterministic stdout ordering
- Prefer seeded LLM adapter in CI; disable external providers
- Cache `pnpm` store and `node_modules/.vite` to speed up UI tests
- Parallel test execution with proper isolation

## Future Extensions

This contract may be extended as test-utils evolves to include:

- Additional adapter implementations for new SAGE packages
- Enhanced scenario DSL with more complex agent interactions
- Advanced mocking capabilities for external dependencies
- Performance testing utilities and benchmarks
- Integration with cloud-based testing infrastructure
- Enhanced debugging and tracing capabilities
- Support for property-based testing and fuzzing