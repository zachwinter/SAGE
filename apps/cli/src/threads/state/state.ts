import { Chat } from "@lmstudio/sdk";
import { proxy } from "valtio";
import { listCurrentThreads } from "../utils/persistence";
import { createDirectoryManager } from "@sage/utils";

export type Turn = "user" | "assistant";
export type ConfirmationStatus = "pending" | "denied" | "approved";

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
  refreshSavedThreads?: () => void;
}

// Create a function to refresh the saved threads list
const refreshSavedThreads = () => {
  try {
    const directoryManager = createDirectoryManager();
    const threadsDir = directoryManager.getUserDataDir() + "/threads";
    const threads = listCurrentThreads(threadsDir);
    // Update the saved threads in state
    (state as any).saved = threads;
  } catch (error) {
    // If we can't read the threads directory, set to empty array
    console.warn(`Failed to read threads directory: ${error}`);
    (state as any).saved = [];
  }
};

export const state = proxy<ThreadsState>({
  saved: [],
  active: null,
  turn: "user",
  message: "",
  activeThreadId: null,
  response: "",
  streamingToolCalls: [],
  pendingToolCallConfirmation: null,
  resolveConfirmation: null,
  refreshSavedThreads
});

// Initialize the saved threads list
refreshSavedThreads();
