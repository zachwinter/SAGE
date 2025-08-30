// Common adapter interfaces matching CONTRACT.md specifications

export interface GraphAdapter {
  query<T>(cypher: string, params?: Record<string, unknown>): Promise<T[]>;
}

export interface ChronicleAdapter {
  read(path: string): Promise<any[]>;
  append(path: string, evt: any): Promise<void>;
}

// Minimal LLM types based on CONTRACT patterns
export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    args: any;
  };
  toolResult?: {
    id: string;
    result: any;
    error?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ChatOptions {
  model: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  tools?: Record<string, {
    description?: string;
    parameters: any;
  }>;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
}

export interface LLMClient {
  createChatStream(opts: ChatOptions): Promise<AsyncIterable<StreamEvent>>;
}

// Tool registry types
export interface Tool<I = any, O = any> {
  name: string;
  description?: string;
  schema: Record<string, any>;
  validate(input: unknown): I;
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
  version?: string;
}

export interface ToolContext {
  cwd: string;
  env?: Record<string, string>;
  dryRun?: boolean;
  permissions?: string[];
  logger?: (evt: any) => void;
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