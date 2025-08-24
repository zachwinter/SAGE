import {
  Chat,
  ChatMessage,
  type LLMPredictionFragmentWithRoundIndex
} from "@lmstudio/sdk";
import { Logger } from "@sage/utils";
import {
  getGlobalAbortController,
  setGlobalAbortController,
  state
} from "../state/state.js";
import {
  addStreamingToolCall,
  appendToStreamingToolCallArgs,
  clearAllStreamingToolCalls,
  flushFragmentBuffer,
  markStreamingToolCallError,
  removeCompletedStreamingToolCalls,
  updateStreamingToolCallName
} from "../streaming/actions.js";
import { act } from "../utils/act.js";
import {
  appendMessageToCurrentActiveThread,
  listCurrentThreads,
  removeLastMessageFromCurrentActiveThread
} from "../utils/persistence.js";

const logger = new Logger("threads:messaging:actions", "debug.log");

export function setMessage(message: string) {
  if (state.turn === "user") {
    state.message = message;
  }
}

export async function sendMessage() {
  logger.info(`📤 sendMessage called with message: "${state.message}"`);

  // Guard: Don't send messages when assistant is already active or during confirmation
  if (state.turn === "assistant") {
    logger.warn(`🚫 Blocked sendMessage: assistant turn already active`);
    return;
  }

  if (state.resolveConfirmation) {
    logger.warn(`🚫 Blocked sendMessage: tool confirmation pending`);
    return;
  }

  // Don't send empty messages unless it's intentional
  if (!state.message.trim()) {
    logger.warn(`🚫 Blocked sendMessage: empty message`);
    return;
  }

  if (!state.active) state.active = Chat.empty();

  state.active.append("user", state.message);

  appendMessageToCurrentActiveThread({
    role: "user",
    content: [{ type: "text", text: state.message }]
  });

  state.message = "";
  logger.info(`🔄 Turn changed from user to assistant`);
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
            const finalFlushPromises = Array.from(completedToolCallIds).map(
              async toolCallId => {
                const streamingCall = state.streamingToolCalls.find(
                  tc => tc.toolCallId === toolCallId
                );
                if (streamingCall) {
                  await flushFragmentBuffer(streamingCall.id);
                }
              }
            );

            // Wait for all flushes, then clean up
            Promise.all(finalFlushPromises).then(() => {
              removeCompletedStreamingToolCalls(completedToolCallIds as any);
            });
          }
        }
      },
      onToolCallStart(callId: number, info: { toolCallId?: string }) {
        try {
          addStreamingToolCall(callId, info);
        } catch (error) {
          logger.error(
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
          logger.error(
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
          logger.error(
            "Error appending tool call fragment:",
            error instanceof Error ? error : String(error)
          );
          markStreamingToolCallError(callId, "Failed to update tool call arguments");
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.name !== "AbortError")
      logger.error("Error in sendMessage:", e instanceof Error ? e : String(e));
    clearAllStreamingToolCalls();
  } finally {
    setGlobalAbortController(null);
    logger.info(`🔄 Turn changed from assistant back to user (act completed)`);
    state.turn = "user";
  }
}

export function refreshThreadList() {
  state.saved = listCurrentThreads();
}

export function interruptGeneration() {
  if (getGlobalAbortController() && state.turn === "assistant") {
    getGlobalAbortController()!.abort();
    setGlobalAbortController(null);
    clearAllStreamingToolCalls();
    state.turn = "user";
  }
}

export function removeLastMessage() {
  if (!state.active || state.active.getLength() === 0) return;

  try {
    state.active.pop();
    state.active = Chat.from(state.active);
    removeLastMessageFromCurrentActiveThread();
  } catch (error) {
    logger.error(
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
    state.pendingToolCallConfirmation = null;
  }
}

export function denyToolCall() {
  if (state.resolveConfirmation) {
    state.resolveConfirmation("denied");
    state.pendingToolCallConfirmation = null;
  }
  setTurn("user");
}

export function setTurn(turn: "user" | "assistant") {
  state.turn = turn;
}
