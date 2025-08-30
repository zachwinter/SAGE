# LLM Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/llm` package.

## Overview

`@sage/llm` is the provider-agnostic bridge to Large Language Models. It standardizes chat, tool-use, and streaming across backends (LM Studio, OpenAI, Anthropic, etc.), so agents focus on **what** to think, not **how** to call models.

This contract specifies the expected behavior, interfaces, and guarantees that the LLM implementation must provide.

## Core Guarantees

### Provider-Agnostic

- Same API, different backends.
- Unified interface abstracts away provider-specific details.
- Easy switching between providers without changing application code.

### Deterministic Wrapping

- Inputs/outputs are normalized to a single schema.
- Consistent behavior regardless of underlying provider.
- Predictable API responses across all providers.

### Observability

- Every request/response can emit telemetry (durations, tokens, cache hits).
- Comprehensive logging and monitoring capabilities.
- Traceability with requestId for debugging.

### Safety by Default

- Timeouts, retries with jitter, backoff, and budget guards.
- Configurable safety caps (rate limits, token budgets).
- Secret redaction in telemetry by default.

## Interface Specifications

### Main API Functions

The core LLM API provides functions for interacting with LLM providers:

```typescript
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
  requestId?: string; // for tracing & dedupe
  // Optional policy hook to decide tool permissions at runtime
  guardToolCall?: (
    info: ToolCallInfo
  ) => Promise<"approved" | "denied"> | "approved" | "denied";
  // Abort signal for cancellation
  signal?: AbortSignal;
  // Caching options
  cache?: {
    mode: "read-through" | "record-only" | "bypass";
    hashPrompts?: boolean;
    ttlMs?: number;
    maxEntries?: number;
  };
}

export type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; toolName: string; arguments: unknown; callId: string }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "tool_validation_error"; callId: string; error: string; toolName: string }
  | { type: "round_start"; index: number }
  | { type: "round_end"; index: number }
  | { type: "error"; error: string; recoverable: boolean }
  | { type: "end"; usage?: { prompt: number; completion: number } };

/**
 * Create a chat stream with the current provider, with optional caching
 */
export function createChatStream(
  opts: ChatOptions,
  streamOpts?: StreamOptions
): Promise<AsyncIterable<StreamEvent>>;

/**
 * List available models from the current provider or a specific provider
 */
export function listModels(provider?: string): Promise<ModelInfo[]>;

/**
 * Set the current provider
 */
export function setProvider(provider: LLMProvider): void; // swap at runtime
```

### Provider Interface

All LLM providers must implement the following interface:

```typescript
export interface LLMProvider {
  name: string;
  chat(
    opts: ChatOptions
  ): AsyncIterable<StreamEvent> | Promise<{ text: string }>;
  models(): Promise<{ name: string }[]>;
}
```

### Tool System

The LLM package provides a comprehensive tool system:

```typescript
// Tool call information for guard policies
export type ToolCallInfo = {
  id: string;
  name: string;
  args: unknown;
  round: number;
};

// Tool validation exports
export class ToolValidator {
  validate(toolName: string, args: unknown): Promise<ValidationResult>;
  setApprovalPolicy(policy: (info: ToolCallInfo) => Promise<"approved" | "denied">): void;
}

// Tool lifecycle exports
export class ToolCallManager {
  executeToolCall(call: ToolCall): Promise<unknown>;
  generateCallId(): string;
}

// Security policy exports
export class SecurityPolicyManager {
  createPolicyFunction(): (info: ToolCallInfo) => Promise<"approved" | "denied">;
  evaluatePolicy(context: PolicyContext): Promise<DetailedPolicyResult>;
}
```

## Streaming & Backpressure

### Event Stream

- `createChatStream` yields events as they arrive.
- Callers can apply backpressure by pausing iteration.
- Providers that don't support server-sent streaming are wrapped into timed chunk events.

### Event Types

1. **Text Events** - `{ type: "text"; value: string }`
2. **Tool Call Events** - `{ type: "tool_call"; toolName: string; arguments: unknown; callId: string }`
3. **Tool Result Events** - `{ type: "tool_result"; callId: string; result: unknown }`
4. **Tool Validation Error Events** - `{ type: "tool_validation_error"; callId: string; error: string; toolName: string }`
5. **Round Start Events** - `{ type: "round_start"; index: number }`
6. **Round End Events** - `{ type: "round_end"; index: number }`
7. **Error Events** - `{ type: "error"; error: string; recoverable: boolean }`
8. **End Events** - `{ type: "end"; usage?: { prompt: number; completion: number } }`

### Backpressure Handling

- Configurable buffer size to control memory usage.
- Event timeout handling to prevent hanging streams.
- Graceful error propagation in streams.

## Tool-Use Integration

### JSON Schema Validation

- Tools are described with **JSON Schema**.
- Arguments are validated before execution.
- Malformed arguments result in validation errors, not execution.

### Tool Call Lifecycle

- When a model emits `{type: "tool_call"}`, the caller executes the tool.
- The result is fed back via a synthetic `tool` message.
- Generation continues after tool execution.
- The API preserves **callId** across `tool_call` ⇄ `tool_result` pairs for traceability.

### Security Policies

- Configurable tool approval policies.
- Per-provider allowlists for models and tool-use capabilities.
- Runtime evaluation of tool call permissions.

## Prompt Caching

### Cache Key Generation

- **Cache Key:** `(model, messages, tools, temperature, max_tokens)` hashed canonically.
- Optional **prompt hashing** for cache storage so raw prompts are not persisted.
- Cache keys include context-sensitive information like commit hashes for SAGE.

### Cache Modes

1. **Read-Through** - Serve from cache if present, otherwise compute and store.
2. **Record-Only** - Compute and store but never serve from cache (for evals).
3. **Bypass** - Skip cache entirely.

### Cache Invalidation

- Automatic invalidation when underlying context changes.
- Tied to commit hash of `@sage/graph` for SAGE applications.
- Configurable TTL and maximum cache size.

### Granularity

- Full-turn cache (not token-level) to avoid partial replay artifacts.
- Cached results include complete event streams.
- Metadata preservation for traceability.

## Error Handling

### Timeouts

- **Timeouts** default to 30 seconds but are configurable per call.
- Automatic cleanup of timed-out requests.
- Clear error messages for timeout conditions.

### Retry Policy

- Exponential backoff with jitter on transient errors.
- Configurable retry limits per provider.
- Intelligent error classification for retry decisions.

### Guardrails

- If a provider returns malformed tool args, the wrapper emits a validation error and **does not execute** the tool.
- Rate limiting and token budget guards prevent resource exhaustion.
- Circuit breaker pattern for failing providers.

## Security & Privacy

### Secret Redaction

- Redact secrets in telemetry by default.
- Configurable redaction patterns.
- Audit logging of redaction events.

### Prompt Privacy

- Optional **prompt hashing** for cache storage so raw prompts are not persisted.
- Encryption of sensitive prompt data at rest.
- Access controls for cached prompt data.

### Provider Security

- Per-provider **allowlist** for models and tool-use capabilities.
- Secure credential management.
- Audit trails for provider access.

## Advanced Features

### Event Normalization

- Provider-specific event normalizers ensure consistent event formats.
- Built-in normalizers for OpenAI and Anthropic.
- Extensible normalizer interface for new providers.

### Stream Utilities

- `AsyncQueue` for managing asynchronous event streams.
- `mergeStreams` for combining multiple event streams.
- `mapStream` and `filterStream` for stream transformations.
- `withErrorBoundary` for robust error handling.
- `withTimeout` for stream timeout management.

### Cache System

- `MemoryCache` for in-memory caching with LRU eviction.
- `CacheManager` for coordinating cache operations.
- Configurable cache key generators.
- Cache metrics for monitoring and optimization.

## Future Extensions

This contract may be extended as LLM evolves to include:

- Additional provider adapters for new LLM services
- Enhanced caching strategies including distributed caching
- Advanced telemetry and monitoring features
- Improved security policies and access controls
- Integration with more sophisticated tool ecosystems
- Support for multimodal models and inputs