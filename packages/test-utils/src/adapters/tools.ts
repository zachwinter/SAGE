import type { ToolRegistry, Tool, ToolContext, ToolResult } from "./types.js";

/**
 * In-memory Tool registry for testing
 * Provides fake implementations of standard SAGE tools
 */
export class TestToolRegistry implements ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();
  private readOnly: boolean;
  private executionLog: Array<{
    tool: string;
    input: any;
    result: any;
    timestamp: string;
  }> = [];

  constructor(options: { readOnly?: boolean } = {}) {
    this.readOnly = options.readOnly ?? false;
    this.registerStandardTools();
  }

  register<TI, TO>(tool: Tool<TI, TO>): void {
    this.tools.set(tool.name, tool);
  }

  get<TI, TO>(name: string): Tool<TI, TO> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
    return tool as Tool<TI, TO>;
  }

  getToolSchemas(): { name: string; parameters: any; description?: string }[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      parameters: tool.schema,
      description: tool.description,
    }));
  }

  /**
   * Get execution log (testing utility)
   */
  getExecutionLog(): typeof this.executionLog {
    return [...this.executionLog];
  }

  /**
   * Clear execution log (testing utility)
   */
  clearLog(): void {
    this.executionLog = [];
  }

  private registerStandardTools(): void {
    // Read tool - always safe
    this.register({
      name: "Read",
      description: "Read file contents from workspace",
      schema: {
        type: "object",
        properties: {
          file: { type: "string" },
        },
        required: ["file"],
      },
      validate: (input: unknown) => {
        if (typeof input !== 'object' || input === null) {
          throw new Error('Input must be an object');
        }
        const { file } = input as any;
        if (typeof file !== 'string') {
          throw new Error('file must be a string');
        }
        return { file };
      },
      execute: async (input, ctx) => this.executeRead(input, ctx),
    });

    // Write tool - requires permission
    this.register({
      name: "Write",
      description: "Write content to file",
      schema: {
        type: "object",
        properties: {
          file: { type: "string" },
          content: { type: "string" },
        },
        required: ["file", "content"],
      },
      validate: (input: unknown) => {
        if (typeof input !== 'object' || input === null) {
          throw new Error('Input must be an object');
        }
        const { file, content } = input as any;
        if (typeof file !== 'string' || typeof content !== 'string') {
          throw new Error('file and content must be strings');
        }
        return { file, content };
      },
      execute: async (input, ctx) => this.executeWrite(input, ctx),
    });

    // Edit tool - requires permission
    this.register({
      name: "Edit",
      description: "Apply patch to file",
      schema: {
        type: "object",
        properties: {
          file: { type: "string" },
          patch: { type: "string" },
          strategy: { type: "string", enum: ["apply", "check"] },
        },
        required: ["file", "patch"],
      },
      validate: (input: unknown) => {
        if (typeof input !== 'object' || input === null) {
          throw new Error('Input must be an object');
        }
        const { file, patch, strategy = "apply" } = input as any;
        if (typeof file !== 'string' || typeof patch !== 'string') {
          throw new Error('file and patch must be strings');
        }
        return { file, patch, strategy };
      },
      execute: async (input, ctx) => this.executeEdit(input, ctx),
    });

    // Bash tool - requires permission
    this.register({
      name: "Bash",
      description: "Execute shell command",
      schema: {
        type: "object",
        properties: {
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          timeoutMs: { type: "number" },
        },
        required: ["command"],
      },
      validate: (input: unknown) => {
        if (typeof input !== 'object' || input === null) {
          throw new Error('Input must be an object');
        }
        const { command, args = [], timeoutMs = 5000 } = input as any;
        if (typeof command !== 'string') {
          throw new Error('command must be a string');
        }
        if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) {
          throw new Error('args must be array of strings');
        }
        return { command, args, timeoutMs };
      },
      execute: async (input, ctx) => this.executeBash(input, ctx),
    });

    // GraphQuery tool - always safe
    this.register({
      name: "GraphQuery",
      description: "Execute Cypher query against graph",
      schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          params: { type: "object" },
          commit: { type: "string" },
        },
        required: ["query"],
      },
      validate: (input: unknown) => {
        if (typeof input !== 'object' || input === null) {
          throw new Error('Input must be an object');
        }
        const { query, params = {}, commit } = input as any;
        if (typeof query !== 'string') {
          throw new Error('query must be a string');
        }
        return { query, params, commit };
      },
      execute: async (input, ctx) => this.executeGraphQuery(input, ctx),
    });
  }

  private async executeRead(
    input: { file: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ content: string }>> {
    const startedAt = new Date().toISOString();
    
    try {
      // Simulate file read - in real implementation would actually read
      const mockContent = `// Mock content for ${input.file}\nexport default {};\n`;
      
      const result = { content: mockContent };
      this.logExecution("Read", input, result);
      
      return {
        ok: true,
        data: result,
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 10,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "ERUNTIME",
          message: (error as Error).message,
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 5,
        },
      };
    }
  }

  private async executeWrite(
    input: { file: string; content: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ bytes: number }>> {
    const startedAt = new Date().toISOString();

    if (this.readOnly) {
      return {
        ok: false,
        error: {
          code: "EPERMISSION",
          message: "Write operations disabled in read-only mode",
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 1,
        },
      };
    }

    try {
      // Simulate write operation
      const bytes = Buffer.byteLength(input.content, 'utf8');
      const result = { bytes };
      
      this.logExecution("Write", input, result);
      
      return {
        ok: true,
        data: result,
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 15,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "ERUNTIME",
          message: (error as Error).message,
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 5,
        },
      };
    }
  }

  private async executeEdit(
    input: { file: string; patch: string; strategy: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ patched: boolean; diff?: string }>> {
    const startedAt = new Date().toISOString();

    if (this.readOnly) {
      return {
        ok: false,
        error: {
          code: "EPERMISSION",
          message: "Edit operations disabled in read-only mode",
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 1,
        },
      };
    }

    try {
      // Simulate patch application
      const patched = input.strategy === "apply";
      const diff = patched ? `Applied patch to ${input.file}` : "Patch check passed";
      
      const result = { patched, diff };
      this.logExecution("Edit", input, result);
      
      return {
        ok: true,
        data: result,
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 25,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "ERUNTIME",
          message: (error as Error).message,
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 5,
        },
      };
    }
  }

  private async executeBash(
    input: { command: string; args: string[]; timeoutMs: number },
    ctx: ToolContext
  ): Promise<ToolResult<{ code: number; stdout: string; stderr: string }>> {
    const startedAt = new Date().toISOString();

    if (this.readOnly) {
      return {
        ok: false,
        error: {
          code: "EPERMISSION",
          message: "Bash operations disabled in read-only mode",
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 1,
        },
      };
    }

    try {
      // Simulate command execution with deterministic results
      const fullCommand = [input.command, ...input.args].join(' ');
      let result: { code: number; stdout: string; stderr: string };

      if (input.command === "echo") {
        result = {
          code: 0,
          stdout: input.args.join(' ') + '\n',
          stderr: '',
        };
      } else if (input.command === "ls") {
        result = {
          code: 0,
          stdout: 'file1.txt\nfile2.js\n',
          stderr: '',
        };
      } else if (input.command === "pwd") {
        result = {
          code: 0,
          stdout: ctx.cwd + '\n',
          stderr: '',
        };
      } else {
        // Unknown command
        result = {
          code: 127,
          stdout: '',
          stderr: `${input.command}: command not found\n`,
        };
      }
      
      this.logExecution("Bash", input, result);
      
      return {
        ok: true,
        data: result,
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 50,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "ERUNTIME",
          message: (error as Error).message,
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 5,
        },
      };
    }
  }

  private async executeGraphQuery(
    input: { query: string; params: Record<string, any>; commit?: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ rows: any[] }>> {
    const startedAt = new Date().toISOString();

    try {
      // Simulate graph query - return mock results
      const rows = [
        { id: 'node1', properties: { name: 'example' } },
        { id: 'node2', properties: { name: 'test' } },
      ];
      
      const result = { rows };
      this.logExecution("GraphQuery", input, result);
      
      return {
        ok: true,
        data: result,
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 20,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "ERUNTIME",
          message: (error as Error).message,
        },
        meta: {
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: 5,
        },
      };
    }
  }

  private logExecution(tool: string, input: any, result: any): void {
    this.executionLog.push({
      tool,
      input: { ...input },
      result: { ...result },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Factory function matching CONTRACT.md specification
 */
export function makeTools(options: {
  readOnly?: boolean;
} = {}): ToolRegistry {
  return new TestToolRegistry(options);
}