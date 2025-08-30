# @sage/tools - Implementation Context

## Package Purpose
Sandboxed, type-safe capability layer providing well-defined, auditable actions with strongly-typed inputs/outputs.

## Contract Requirements (from CONTRACT.md)

### Core Tool Interface
```ts
export interface Tool<I = any, O = any> {
  name: string;
  description?: string;
  schema: Record<string, any>; // JSON Schema
  validate(input: unknown): I; // Zod runtime validation
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
  version?: string;
}

export interface ToolContext {
  cwd: string;
  env?: Record<string, string>;
  dryRun?: boolean;
  permissions?: string[];
  logger?: (evt: ToolLog) => void;
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
```

## Standard Tools Required
- **GraphQuery** (read-only): `{ query: string; params?: object; commit?: string }` → `{ rows: any[] }`
- **Read**: `{ file: string }` → `{ content: string }`
- **Write**: `{ file: string; content: string }` → `{ bytes: number }`
- **Edit**: `{ file: string; patch: string; strategy?: "apply"|"check" }` → `{ patched: boolean; diff?: string }`
- **Bash**: `{ command: string; args?: string[]; timeoutMs?: number }` → `{ code: number; stdout: string; stderr: string }`

## Security & Sandboxing
- **Process isolation**: child processes with restricted env/cwd
- **Path policies**: prevent writes outside workspace; `.sage/` protected
- **Allow/deny lists**: per-tool command allowlists (git, tsc allowed; network denied)
- **I/O quotas**: max stdout/stderr bytes, execution timeouts
- **Dry-run mode**: simulate effects without mutation

## Default Permission Policy
```ts
const SAFE_TOOLS = new Set(["GraphQuery", "Read"]);
// All others require explicit confirmation unless overridden
```

## Error Taxonomy
- `EVALIDATION` - input failed Zod/JSON Schema validation
- `EPERMISSION` - denied by permission or path policy
- `ERUNTIME` - tool threw during execution
- `ETIMEOUT` - exceeded max execution time
- `EQUOTA` - stdout/stderr or file size limit exceeded

## Integration Points
- **@sage/graph**: GraphQuery tool integration
- **@sage/llm**: JSON Schema export for tool calling
- **@sage/agents**: Delegator uses tools under Transaction Boundary
- **@sage/chronicle**: Optional tool outcome recording

## Key Patterns
- **Transaction Boundary**: Delegator runs Edit/Write in staging; atomic commit
- **Read-only by default**: Tools opt-in to mutating abilities
- **Deterministic mode**: Disable time, randomness, network for reproducible runs

## Dependencies
- `@sage/utils` for error handling and types
- `@sage/graph` for GraphQuery tool
- Zod for runtime validation
- JSON Schema for LLM integration