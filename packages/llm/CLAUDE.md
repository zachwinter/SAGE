# @sage/llm - Implementation Context

## Package Purpose
Provider-agnostic bridge to Large Language Models with unified streaming, tool-calling, and caching.

## Contract Requirements (from CONTRACT.md)

### Core API
```ts
export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  tool_call_id?: string;
}

export interface ToolSchema {
  name: string;
  description?: string;
  parameters: Record<string, unknown>; // JSON Schema
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

export function createChatStream(opts: ChatOptions): AsyncIterable<StreamEvent>;
export function setProvider(provider: LLMProvider): void;
export function listModels(provider?: string): Promise<ModelInfo[]>;
```

### Provider Interface
```ts
export interface LLMProvider {
  name: string;
  chat(opts: ChatOptions): AsyncIterable<StreamEvent> | Promise<{ text: string }>;
  models(): Promise<{ name: string }[]>;
}
```

## Key Requirements
- **Provider-agnostic**: Same API across OpenAI, Anthropic, LM Studio, etc.
- **Streaming support**: Real-time token emission with backpressure handling
- **Tool integration**: JSON Schema validation and structured calling
- **Safety by default**: Timeouts, retries, rate limits, error boundaries
- **Caching**: Prompt-level caching with canonical key generation

## Tool Integration
- Tools described with JSON Schema for LLM consumption
- Arguments validated before execution
- `callId` pairing across `tool_call` ↔ `tool_result` events
- Malformed tool args → validation error (do NOT execute)

## Caching Strategy
- Cache key: `(model, messages, tools, temperature, max_tokens)` canonically hashed
- Modes: read-through, record-only, bypass
- Full-turn caching (not token-level) to avoid replay artifacts
- Optional prompt hashing for privacy

## Error Handling & Safety
- Configurable timeouts (default 30s)
- Exponential backoff retry with jitter
- Provider-specific error normalization
- Secret redaction in telemetry
- Tool validation boundaries

## Provider Adapters Needed
- **OpenAI**: GPT-4, streaming, tool calling
- **Anthropic**: Claude, streaming, tool calling  
- **LM Studio**: For direct connection to local LM Studio instances.
- **@sage/mcp**: For connecting to any MCP-compliant server, providing enterprise-grade server management.
- **Test/Fake**: Deterministic providers for testing

## Integration with @sage/aql
- AQL compiles declarative queries into streaming executions via this API
- Must support complex multi-step, multi-agent workflows
- Tool calls routed through @sage/tools registry

## Integration with @sage/mcp

The `@sage/llm` package integrates with `@sage/mcp` via a dedicated `MCPProvider`. This allows `@sage/llm` to communicate with any server that adheres to the Model Context Protocol (MCP), leveraging `@sage/mcp`'s robust server lifecycle management.

### MCPProvider Interface

The `MCPProvider` will implement the standard `LLMProvider` interface, taking an instance of `@sage/mcp`'s `MCPClientManager` in its constructor.

```ts
import { MCPClientManager } from '@sage/mcp';
import { LLMProvider } from '@sage/llm';

// Simplified constructor
class MCPProvider implements LLMProvider {
  constructor(private mcpManager: MCPClientManager) {}
  // ... implementation ...
}
```

This pattern separates the concerns of the unified LLM interface (`@sage/llm`) from the specifics of the MCP protocol implementation (`@sage/mcp`).

## Dependencies
- `@sage/utils` for canonicalization, hashing, error handling
- `@sage/tools` for tool schema integration (optional)
- Provider-specific SDKs (OpenAI, Anthropic, etc.)