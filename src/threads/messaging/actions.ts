import {
  Chat,
  ChatMessage,
  type LLMPredictionFragmentWithRoundIndex
} from "@lmstudio/sdk";
import { state } from "../state/state.js";
import { act } from "../utils/act.js";
import Logger from "../../logger/logger.js";
import {
  appendMessageToCurrentActiveThread,
  removeLastMessageFromCurrentActiveThread,
  listCurrentThreads
} from "../utils/persistence.js";
import {
  clearAllStreamingToolCalls,
  addStreamingToolCall,
  updateStreamingToolCallName,
  appendToStreamingToolCallArgs,
  markStreamingToolCallError,
  removeCompletedStreamingToolCalls,
  flushFragmentBuffer
} from "../streaming/actions.js";

export function setMessage(message: string) {
  if (state.turn === "user") {
    state.message = message;
  }
}

export async function sendMessage() {
  if (!state.active) state.active = Chat.empty();

  state.active.append("user", state.message);

  appendMessageToCurrentActiveThread({
    role: "user",
    content: [{ type: "text", text: state.message }]
  });

  state.message = "";
  state.turn = "assistant";
  state.response = "";

  clearAllStreamingToolCalls();

  try {
    await act(state.active, {
      onRoundStart() {
        state.response = "";
        clearAllStreamingToolCalls();
      },
      onContentFragment(fragment: LLMPredictionFragmentWithRoundIndex) {
        state.response += fragment.content;
      },
      onMessage(message: ChatMessage) {
        appendMessageToCurrentActiveThread(message);

        if (state.active) {
          state.active.append(message);
          state.active = Chat.from(state.active);
          const completedRequests = message.getToolCallRequests();
          if (completedRequests && completedRequests.length > 0) {
            const completedToolCallIds = new Set(
              completedRequests.map(req => req.id)
            );
            // Ensure immediate flush of all completed tool calls
            const finalFlushPromises = completedToolCallIds.map(async toolCallId => {
              const streamingCall = state.streamingToolCalls.find(
                tc => tc.toolCallId === toolCallId
              );
              if (streamingCall) {
                await flushFragmentBuffer(streamingCall.id);
              }
            });

            // Wait for all flushes, then clean up
            Promise.all(Array.from(finalFlushPromises)).then(() => {
              removeCompletedStreamingToolCalls(completedToolCallIds as any);
            });
          }
        }
      },
      onToolCallStart(callId: number, info: { toolCallId?: string }) {
        try {
          addStreamingToolCall(callId, info);
        } catch (error) {
          Logger.error(
            "Error adding tool call:",
            error instanceof Error ? error : String(error)
          );
          markStreamingToolCallError(callId, "Failed to initialize tool call");
        }
      },
      onToolCallName(callId: number, name: string) {
        try {
          updateStreamingToolCallName(callId, name);
        } catch (error) {
          Logger.error(
            "Error updating tool call name:",
            error instanceof Error ? error : String(error)
          );
          markStreamingToolCallError(callId, "Failed to update tool call name");
        }
      },
      onToolCallFragment(callId: number, fragment: string) {
        try {
          appendToStreamingToolCallArgs(callId, fragment);
        } catch (error) {
          Logger.error(
            "Error appending tool call fragment:",
            error instanceof Error ? error : String(error)
          );
          markStreamingToolCallError(callId, "Failed to update tool call arguments");
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.name !== "AbortError")
      Logger.error("Error in sendMessage:", e instanceof Error ? e : String(e));
    clearAllStreamingToolCalls();
  } finally {
    state.currentAbortController = null;
    state.turn = "user";
  }
}

export function refreshThreadList() {
  state.saved = listCurrentThreads();
  state.refresh = Date.now();
}

export function interruptGeneration() {
  if (state.currentAbortController && state.turn === "assistant") {
    state.currentAbortController.abort();
    state.currentAbortController = null;
    state.turn = "user";
    clearAllStreamingToolCalls();
  }
}

export function removeLastMessage() {
  if (!state.active || state.active.getLength() === 0) return;

  try {
    state.active.pop();
    state.active = Chat.from(state.active);
    removeLastMessageFromCurrentActiveThread();
  } catch (error) {
    Logger.error(
      "Failed to remove last message:",
      error instanceof Error ? error : String(error)
    );
  }
}
export function setPendingToolCall(callId: number, args: any) {
  const toolCall = state.streamingToolCalls.find(tc => tc.id === callId);
  if (toolCall) {
    toolCall.arguments = JSON.stringify(args, null, 2);
    toolCall.confirmationStatus = "pending";
    state.pendingToolCallConfirmation = toolCall;
  }
}

export function approveToolCall() {
  if (state.resolveConfirmation) {
    state.resolveConfirmation("approved");
  }
}

export function denyToolCall() {
  if (state.resolveConfirmation) {
    state.resolveConfirmation("denied");
  }
}
