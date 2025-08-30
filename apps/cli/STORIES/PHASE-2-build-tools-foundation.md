# STORY: Build Tools Foundation in @sage/tools

## Overview
Create the `@sage/tools` package with a complete set of standard tools, implementing the missing functionality that the CLI currently has disabled and establishing the sandboxed capability layer for SAGE agents.

## Current State
The CLI has tool calling infrastructure but tools are disabled:
- ✅ Tool call confirmation system in place (`act.ts`)
- ✅ UI for tool call display and approval
- ✅ Auto-approval for `GraphQuery` and `Read` tools
- ❌ Actual tool implementations missing (empty array in `act.ts`)
- ❌ Tool registry not implemented
- ❌ Sandboxing and validation missing

## Success Criteria
- [ ] `@sage/tools` package created with full tool registry
- [ ] Standard tools implemented: `Read`, `Write`, `Edit`, `GraphQuery`, `Bash`
- [ ] JSON Schema generation for LLM tool calling
- [ ] Zod validation for all tool inputs
- [ ] Sandboxing and security policies implemented
- [ ] CLI updated to use real tools instead of empty array
- [ ] All tool confirmation flows working
- [ ] Integration tests passing

## Implementation Plan

### Step 1: Create @sage/tools Package Structure
```bash
packages/tools/
├── src/
│   ├── index.ts              # Main exports
│   ├── registry/
│   │   ├── ToolRegistry.ts   # Central tool registry
│   │   └── types.ts          # Registry types
│   ├── tools/
│   │   ├── Read.ts           # Read file tool
│   │   ├── Write.ts          # Write file tool
│   │   ├── Edit.ts           # Edit file tool
│   │   ├── GraphQuery.ts     # Query code graph
│   │   └── Bash.ts           # Execute shell commands
│   ├── sandbox/
│   │   ├── policies.ts       # Security policies
│   │   ├── isolation.ts      # Process isolation
│   │   └── validation.ts     # Input validation
│   └── schemas/
│       ├── generator.ts      # JSON Schema generation
│       └── validation.ts     # Zod schemas
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Step 2: Define Core Tool Interface
```typescript
export interface Tool<I = any, O = any> {
  name: string;
  description?: string;
  schema: JSONSchema;           // For LLM consumption
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
  secretProvider?: SecretProvider;
}

export interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { startedAt: string; endedAt: string; durationMs: number };
}
```

### Step 3: Implement Standard Tools

#### Read Tool
```typescript
export const Read = (): Tool<{ file: string }, { content: string }> => ({
  name: "Read",
  description: "Read file contents from the workspace",
  schema: {
    type: "object",
    properties: {
      file: { type: "string", description: "Path to file to read" }
    },
    required: ["file"]
  },
  validate: (input) => z.object({ file: z.string() }).parse(input),
  execute: async (input, ctx) => {
    // Implementation with path validation and sandboxing
    const safePath = validatePath(input.file, ctx.cwd);
    const content = await fs.readFile(safePath, 'utf-8');
    return { ok: true, data: { content } };
  }
});
```

#### Write Tool
```typescript
export const Write = (): Tool<{ file: string; content: string }, { bytes: number }> => ({
  name: "Write",
  description: "Write content to a file",
  schema: {
    type: "object", 
    properties: {
      file: { type: "string", description: "Path to file to write" },
      content: { type: "string", description: "Content to write" }
    },
    required: ["file", "content"]
  },
  validate: (input) => z.object({
    file: z.string(),
    content: z.string()
  }).parse(input),
  execute: async (input, ctx) => {
    // Implementation with path validation and backup
    const safePath = validateWritePath(input.file, ctx.cwd);
    const bytes = await fs.writeFile(safePath, input.content, 'utf-8');
    return { ok: true, data: { bytes } };
  }
});
```

#### GraphQuery Tool
```typescript
export const GraphQuery: Tool<{ query: string; params?: object }, { rows: any[] }> = {
  name: "GraphQuery",
  description: "Query the code graph with Cypher",
  schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Cypher query to execute" },
      params: { type: "object", description: "Query parameters" }
    },
    required: ["query"]
  },
  validate: (input) => z.object({
    query: z.string(),
    params: z.object({}).optional()
  }).parse(input),
  execute: async (input, ctx) => {
    // Integration with @sage/graph
    const graphClient = getGraphClient(ctx.cwd);
    const rows = await graphClient.query(input.query, input.params);
    return { ok: true, data: { rows } };
  }
};
```

### Step 4: Implement Tool Registry
```typescript
export class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();

  register<TI, TO>(tool: Tool<TI, TO>): void {
    this.tools.set(tool.name, tool);
  }

  get<TI, TO>(name: string): Tool<TI, TO> | undefined {
    return this.tools.get(name);
  }

  getToolSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }));
  }

  async execute<T>(
    name: string, 
    input: unknown, 
    ctx: ToolContext
  ): Promise<ToolResult<T>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: { code: "ENOTFOUND", message: `Tool ${name} not found` } };
    }
    
    try {
      const validInput = tool.validate(input);
      return await tool.execute(validInput, ctx);
    } catch (error) {
      return { 
        ok: false, 
        error: { 
          code: "EVALIDATION", 
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}
```

### Step 5: Security and Sandboxing
```typescript
// Path validation
export function validatePath(path: string, cwd: string): string {
  const resolved = resolve(cwd, path);
  
  // Must be within workspace
  if (!resolved.startsWith(cwd)) {
    throw new Error(`Path ${path} is outside workspace`);
  }
  
  // Cannot access .sage directory
  if (resolved.includes('/.sage/')) {
    throw new Error(`Access to .sage directory denied`);
  }
  
  return resolved;
}

// Permission policies
export const DEFAULT_POLICIES = {
  SAFE_TOOLS: new Set(["Read", "GraphQuery"]),
  WRITE_TOOLS: new Set(["Write", "Edit"]),
  EXEC_TOOLS: new Set(["Bash"]),
  
  // Auto-approve safe tools
  shouldConfirm(toolName: string): boolean {
    return !this.SAFE_TOOLS.has(toolName);
  }
};
```

### Step 6: CLI Integration
1. **Update Dependencies**
   ```json
   {
     "dependencies": {
       "@sage/tools": "workspace:*"
     }
   }
   ```

2. **Update act.ts**
   ```typescript
   // Before
   await model.act(chat, [], { // Empty tools array
   
   // After
   import { toolRegistry } from "@sage/tools";
   
   const tools = toolRegistry.getToolSchemas();
   await model.act(chat, tools, {
   ```

3. **Tool Execution Integration**
   ```typescript
   // Update guardToolCall to use tool registry
   guardToolCall: async (roundIndex, callId, controller) => {
     const toolName = controller.toolCallRequest.name;
     const shouldConfirm = !["GraphQuery", "Read"].includes(toolName);
     
     const decision = shouldConfirm 
       ? await confirmationFlow(controller.toolCallRequest)
       : "approved";
     
     if (decision === "approved") {
       const result = await toolRegistry.execute(
         toolName,
         controller.toolCallRequest.arguments,
         { cwd: process.cwd(), logger: logger.info }
       );
       controller.allow(result);
     } else {
       controller.deny("User denied execution");
     }
   }
   ```

### Step 7: Testing Strategy
1. **Unit Tests**
   - Each tool with valid/invalid inputs
   - Path validation and sandboxing
   - Registry operations
   
2. **Integration Tests**
   - CLI tool calling end-to-end
   - Confirmation flows
   - Error handling

3. **Security Tests**
   - Path traversal attempts
   - Privilege escalation
   - Resource exhaustion

## Files to Change

### New Files
- `packages/tools/` (entire package)

### Modified Files
- `apps/cli/package.json` (add dependency)
- `apps/cli/src/threads/utils/act.ts` (add real tools)
- `apps/cli/src/threads/messaging/actions.ts` (tool execution)

## Risk Mitigation
- **Medium Risk**: Tool security and sandboxing
- **Low Risk**: Registry and validation logic
- **Mitigation**: Comprehensive security testing and gradual rollout

## Dependencies
- `@sage/graph` for GraphQuery tool integration
- `@sage/utils` for error handling and logging
- `zod` for runtime validation
- Future integration with `@sage/llm` for schema export

## Success Validation
1. All tools work in CLI with proper confirmation
2. Security policies prevent dangerous operations
3. JSON Schema generation works for LLM integration
4. Auto-approval works for Read/GraphQuery
5. Error handling is comprehensive
6. Performance is acceptable for typical operations

## Next Phase
With tools foundation complete, Phase 3 can extract the UI components that display tool calls and confirmations.