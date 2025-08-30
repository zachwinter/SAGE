import type { ReactNode } from "react";

// Stream event types from @sage/llm
export type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; toolName: string; arguments: unknown; callId: string }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "end"; usage?: { prompt: number; completion: number } };

// Streaming chat components
export interface ChatProps {
  /** Stream of events to render */
  stream: AsyncIterable<StreamEvent>;
  /** Chat children */
  children?: ReactNode;
}

export interface AssistantTurnProps {
  /** Additional props for the assistant turn */
  [key: string]: any;
}

export interface UserMessageProps {
  /** User message content */
  children?: ReactNode;
}

// Streaming components (will be implemented by adapters)
export type { ChatProps, AssistantTurnProps, UserMessageProps };
export const Chat = (props: ChatProps) => {
  throw new Error("Chat component must be implemented by a renderer adapter");
};

export const AssistantTurn = (props?: AssistantTurnProps) => {
  throw new Error("AssistantTurn component must be implemented by a renderer adapter");
};

export const UserMessage = (props: UserMessageProps) => {
  throw new Error("UserMessage component must be implemented by a renderer adapter");
};

// Additional components
export const ToolCall = (props: { children?: ReactNode }) => {
  throw new Error("ToolCall component must be implemented by a renderer adapter");
};

export const Spinner = (props: { type?: string }) => {
  throw new Error("Spinner component must be implemented by a renderer adapter");
};