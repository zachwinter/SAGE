# Tools Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/tools` package.

## Overview

`@sage/tools` is a sandboxed, type-safe capability layer for SAGE agents. Each tool is a **well-defined, auditable action** with strongly-typed inputs and outputs. Tools are invoked via a central **registry** and described with **JSON Schema** for LLM tool-calling.

This contract specifies the expected behavior, interfaces, and guarantees that the tools implementation must provide.

## Core Guarantees

### Type Safety

- All inputs/outputs are validated using Zod and JSON Schema
- Strong typing ensures compile-time error detection
- Runtime validation prevents invalid inputs from reaching tool implementations
- Type inference provides excellent developer experience

### Principle of Least Power

- Tools are narrowly scoped with explicit permissions
- Each tool has a single, well-defined purpose
- Tools opt-in to mutating abilities rather than having broad permissions
- Permission system allows fine-grained access control

### Auditability

- Every call returns a machine-readable transcript (args, duration, exit status)
- Execution metadata includes timing, resource usage, and error information
- All tool calls are logged for debugging and monitoring
- Deterministic interfaces ensure reproducible behavior

### Deterministic Interfaces

- Stable schemas with semantic versioning per tool
- Consistent input/output formats across tool versions
- Backward compatibility within major version releases
- Clear deprecation policies for interface changes

## Interface Specifications

### Tool Interface

```typescript
export interface Tool<I, O> {
  name: string;
  description?: string;
  schema: JSONSchema; // for LLM tool-calls
  validate(input: unknown): I; // Zod runtime validation
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
  version?: string; // semantic version per tool
}

export interface ToolContext {
  cwd: string;
  env?: Record<string, string>;
  dryRun?: boolean;
  permissions?: string[]; // e.g., ["fs:read", "fs:write:src/**"]
  logger?: (evt: ToolLog) => void;
  /**
   * An optional secret provider for just-in-time value injection.
   * If provided, the tool runner is responsible for placeholder substitution.
   */
  secretProvider?: import("@sage/utils").SecretProvider;
}

export interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { startedAt: string; endedAt: string; durationMs: number };
}
```

### Tool Registry

```typescript
export interface ToolRegistry {
  /**
   * Register a tool in the registry
   */
  register(tool: Tool<any, any>): void;

  /**
   * Get a tool by name
   */
  get(name: string): Tool<any, any>;

  /**
   * Get all tool schemas for LLM tool-calling
   */
  getToolSchemas(): ToolSchema[];

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean;

  /**
   * Remove a tool from the registry
   */
  remove(name: string): void;

  /**
   * Clear all tools from the registry
   */
  clear(): void;
}
```

### Standard Tools

#### Read Tool

```typescript
export interface ReadToolInput {
  file: string;
}

export interface ReadToolOutput {
  content: string;
}

/**
 * Create a Read tool instance
 */
export function createReadTool(): Tool<ReadToolInput, ReadToolOutput>;
```

#### Write Tool

```typescript
export interface WriteToolInput {
  file: string;
  content: string;
}

export interface WriteToolOutput {
  written: boolean;
}

/**
 * Create a Write tool instance
 */
export function createWriteTool(): Tool<WriteToolInput, WriteToolOutput>;
```

#### Edit Tool

```typescript
export interface EditToolInput {
  file: string;
  patch: string; // unified diff
  strategy?: "apply" | "check";
}

export interface EditToolOutput {
  applied: boolean;
  diff?: string;
}

/**
 * Create an Edit tool instance
 */
export function createEditTool(): Tool<EditToolInput, EditToolOutput>;
```

#### Bash Tool

```typescript
export interface BashToolInput {
  command: string;
  args?: string[];
}

export interface BashToolOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create a Bash tool instance
 */
export function createBashTool(): Tool<BashToolInput, BashToolOutput>;
```

#### GraphQuery Tool

```typescript
export interface GraphQueryToolInput {
  query: string;
  params?: Record<string, any>;
  commit?: string;
}

export interface GraphQueryToolOutput {
  results: any[];
}

/**
 * GraphQuery tool instance
 */
export const GraphQuery: Tool<GraphQueryToolInput, GraphQueryToolOutput>;
```

## Security & Sandboxing

### Process Isolation

- Child processes spawned with restricted environment and working directory
- Limited system resource access to prevent abuse
- Isolated execution contexts for each tool call
- Proper cleanup of temporary resources

### Allow/Deny Lists

- Per-tool and per-call command allowlists (e.g., `git`, `tsc` allowed; network calls denied)
- Configurable security policies for different environments
- Runtime validation of commands against allowlists
- Clear error messages for denied operations

### I/O Quotas

- Max stdout/stderr bytes to prevent resource exhaustion
- Execution timeouts to prevent hanging processes
- CPU and filesystem usage limits
- Graceful handling of quota violations

### Path Policies

- Prevent writes outside workspace to maintain isolation
- Protect `.sage/` directory by default (except Chronicle adapters)
- Validate all file paths against security policies
- Normalize and resolve paths to prevent directory traversal

### Dry-run Mode

- Simulate effects and return diffs without mutation
- Safe way to preview tool effects
- Useful for testing and validation
- Clear indication when in dry-run mode

## Secret Management (Vault-Warden Protocol)

### Secret Resolver Middleware

- Before a tool's `execute` method is called, a Secret Resolver middleware scans all string-based inputs for placeholders (e.g., `$ENV.GITHUB_API_KEY`)
- Just-in-time injection when a `secretProvider` is present in the `ToolContext`
- Redaction of secrets from any `stdout`, `stderr`, or `ToolResult` data after execution

### Secret Provider Interface

```typescript
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
```

## Error Taxonomy

### EVALIDATION

- Input failed Zod/JSON Schema validation
- Clear error messages with validation details
- Early detection of invalid inputs
- Prevents invalid data from reaching tool implementations

### EPERMISSION

- Denied by permission or path policy
- Clear indication of which permission was denied
- Guidance on how to resolve permission issues
- Audit trail of permission checks

### ERUNTIME

- Tool threw during execution
- Proper error wrapping and context preservation
- Stack trace information for debugging
- Recovery strategies when possible

### ETIMEOUT

- Exceeded max execution time
- Configurable timeout values per tool
- Graceful termination of timed-out processes
- Clear error messages with timeout details

### EQUOTA

- stdout/stderr or file size limit exceeded
- Resource usage monitoring and limits
- Graceful handling of quota violations
- Clear error messages with quota details

## Patterns

### Transaction Boundary

- Delegator runs `Edit`/`Write` only inside a staging workspace
- Commit is atomic after validators pass
- Rollback on validation failures
- Isolated execution environments

### Read-only by Default

- Tools opt-in to mutating abilities
- Registry can be instantiated in read-only mode for brainstorming sessions
- Clear distinction between read and write operations
- Safe default behavior for exploratory use

### Deterministic Mode

- Disable time, randomness, and network for reproducible runs
- Useful for testing and debugging
- Configurable deterministic behavior
- Consistent outputs for identical inputs

## Advanced Features

### LLM Integration

- Tools described with JSON Schema for LLM tool-calling
- Automatic schema generation from Zod definitions
- Integration with @sage/llm for seamless tool usage
- Default auto-approval policy for read-only tools

### Testing Support

- Use @sage/test-utils to mount a temp workspace
- Inject mock adapters (Graph/Chronicle) for isolated testing
- Verify diffs before/after tool execution
- Deterministic testing with controlled inputs

### Custom Tool Definition

```typescript
export interface ToolDefinition<T extends z.ZodObject<any> = any> {
  name: string;
  description: string;
  parameters: T;
  implementation: (
    args: z.infer<T>,
    context: ToolContext
  ) => Promise<any>;
}

/**
 * Define a custom tool
 */
export function defineTool<T extends z.ZodObject<any>>(
  definition: ToolDefinition<T>
): Tool<z.infer<T>, any>;
```

## Future Extensions

This contract may be extended as tools evolves to include:

- Additional standard tools for common operations
- Enhanced security features and policies
- Advanced monitoring and observability capabilities
- Integration with cloud-based tool providers
- Support for streaming tool outputs
- Enhanced error recovery and retry mechanisms
- Advanced permission and access control features