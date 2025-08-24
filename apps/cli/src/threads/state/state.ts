import { Chat } from "@lmstudio/sdk";
import { proxy } from "valtio";
import { listCurrentThreads } from "../utils/persistence";

export type Turn = "user" | "assistant";
export type ConfirmationStatus = "pending" | "approved" | "denied";

const abort: { AbortController: AbortController | null } = {
  AbortController: null
};

export function getGlobalAbortController() {
  return abort.AbortController;
}

export function setGlobalAbortController(controller: AbortController | null) {
  abort.AbortController = controller;
}

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
  pendingToolCallConfirmation: null,
  resolveConfirmation: null
});
