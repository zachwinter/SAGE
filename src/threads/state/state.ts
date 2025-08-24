import { proxy } from "valtio";
import { listCurrentThreads } from "@/threads/utils/persistence.js";
import { Chat } from "@lmstudio/sdk";

export type Turn = "user" | "assistant";
export type ConfirmationStatus = "pending" | "approved" | "denied";

export type StreamingToolCall = {
  id: number;
  toolCallId?: string;
  name: string;
  arguments: string;
  createdAt: number;
  hasError?: boolean;
  errorMessage?: string;
  confirmationStatus?: ConfirmationStatus;
  result?: { success: boolean; message: string };
};

export interface ThreadsState {
  saved: string[];
  active: Chat | null;
  activeThreadId: string | null;
  turn: Turn;
  message: string;
  response: string;
  streamingToolCalls: StreamingToolCall[];
  refresh: number;
  currentAbortController: AbortController | null;
  pendingToolCallConfirmation: StreamingToolCall | null;
  resolveConfirmation: ((result: "approved" | "denied") => void) | null;
}

export const state = proxy<ThreadsState>({
  saved: listCurrentThreads(),
  active: null,
  turn: "user",
  message: "",
  activeThreadId: null,
  response: "",
  streamingToolCalls: [],
  pendingToolCallConfirmation: null, // ADD THIS
  resolveConfirmation: null,
  refresh: 0,
  currentAbortController: null
});
