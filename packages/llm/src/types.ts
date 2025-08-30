// src/types.ts
// Core type definitions for @sage/llm

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

// Tool call information for guard policies
export type ToolCallInfo = {
  id: string;
  name: string;
  args: unknown;
  round: number;
};

export type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; toolName: string; arguments: unknown; callId: string }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "tool_validation_error"; callId: string; error: string; toolName: string }
  | { type: "round_start"; index: number }
  | { type: "round_end"; index: number }
  | { type: "error"; error: string; recoverable: boolean }
  | { type: "end"; usage?: { prompt: number; completion: number } };

// Type guards for better discriminant unions
export function isTextEvent(event: StreamEvent): event is { type: "text"; value: string } {
  return event.type === "text";
}

export function isToolCallEvent(event: StreamEvent): event is { type: "tool_call"; toolName: string; arguments: unknown; callId: string } {
  return event.type === "tool_call";
}

export function isToolResultEvent(event: StreamEvent): event is { type: "tool_result"; callId: string; result: unknown } {
  return event.type === "tool_result";
}

export function isToolValidationErrorEvent(event: StreamEvent): event is { type: "tool_validation_error"; callId: string; error: string; toolName: string } {
  return event.type === "tool_validation_error";
}

export function isRoundStartEvent(event: StreamEvent): event is { type: "round_start"; index: number } {
  return event.type === "round_start";
}

export function isRoundEndEvent(event: StreamEvent): event is { type: "round_end"; index: number } {
  return event.type === "round_end";
}

export function isErrorEvent(event: StreamEvent): event is { type: "error"; error: string; recoverable: boolean } {
  return event.type === "error";
}

export function isEndEvent(event: StreamEvent): event is { type: "end"; usage?: { prompt: number; completion: number } } {
  return event.type === "end";
}

// Stream configuration options
export interface StreamOptions {
  // Backpressure configuration
  maxBufferSize?: number;
  // Timeout for individual events
  eventTimeoutMs?: number;
  // Enable/disable specific event types
  enableRoundEvents?: boolean;
  enableToolValidation?: boolean;
}

// Event lifecycle information
export interface EventContext {
  requestId: string;
  round: number;
  provider: string;
  model: string;
  timestamp: Date;
}

// Enhanced stream event with context
export interface StreamEventWithContext {
  event: StreamEvent;
  context: EventContext;
}

export interface LLMProvider {
  name: string;
  chat(opts: ChatOptions): AsyncIterable<StreamEvent> | Promise<{ text: string }>;
  models(): Promise<{ name: string }[]>;
}