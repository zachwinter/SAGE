# @sage/aql - Implementation Context

## Package Purpose
Declarative, GraphQL-inspired DSL for orchestrating LLM calls, tools, and multi-agent workflows with type safety and streaming execution.

## Contract Requirements (from CONTRACT.md)

### Core API
```ts
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
```

## Syntax Requirements (Normative Subset)
```aql
query Name($var: Type!) { 
  step1: agent(model: "foo") { 
    prompt: "...{{var}}..." 
  } 
  final: merge(step1) 
}

parallel { 
  a: agent(...); 
  b: agent(...) 
}
```

## Key Features
- **GraphQL-inspired syntax**: Familiar query structure with variables
- **Type system**: Statically validate dataflow across steps
- **Parallel execution**: `parallel { ... }` blocks execute concurrently
- **Control flow**: `if/else`, `while`, `map`, `merge` operations
- **Provider-agnostic**: Works with any @sage/llm provider
- **Tool integration**: References tools by name from @sage/tools registry

## Execution Model
1. **Parse & Type-check**: Build AST, validate variables/dataflow/tool types
2. **Plan**: Construct DAG with parallel islands and dependencies  
3. **Execute**: Stream tokens via @sage/llm, invoke tools via @sage/tools
4. **Emit telemetry**: Optional Chronicle events and debugging traces

## Integration Points
- **@sage/llm**: Streaming & tool calls (provider-agnostic)
- **@sage/tools**: Real-world actions (Read/Write/Edit/Bash/GraphQuery)
- **@sage/agents**: Optional review/approval hooks for Plan steps
- **@sage/chronicle**: Chronicle events (`PLAN_DRAFTED`, `EXECUTION_REPORT`)

## LM Studio Compatibility
When active provider is LM Studio, route through LMStudioProvider which bridges to the existing `act` loop (rounds, tool fragments, guard hooks).

## Error Handling
- Parser must reject unknown top-level fields
- Type checker validates all dataflow and tool arguments
- Runtime errors propagate with structured context
- Graceful degradation for provider failures

## Dependencies  
- `@sage/llm` for streaming and provider abstraction
- `@sage/tools` for tool execution and schema validation
- `@sage/utils` for error handling and canonicalization