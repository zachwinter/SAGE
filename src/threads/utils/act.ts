import { Chat } from "@lmstudio/sdk";
import { getSelectedModel } from "@/models/index.js";
import * as tools from "@/tools";
import { state } from "../state/state.js";
import { setPendingToolCall } from "../messaging/actions.js";
import Logger from "@/logger/logger.js";

export async function act(chat: Chat, events: any) {
  const abortController = new AbortController();
  state.currentAbortController = abortController;
  const model = await getSelectedModel();

  if (!model) return console.error("No model selected.");

  await model.act(chat, Object.values(tools), {
    signal: abortController.signal,

    onRoundStart: roundIndex => events?.onRoundStart?.(roundIndex),
    onRoundEnd: roundIndex => events?.onRoundEnd?.(roundIndex),
    onPredictionFragment: data => events?.onContentFragment?.(data),
    onPredictionCompleted: data => events?.onComplete?.(data),
    onToolCallRequestStart: (roundIndex, callId, info) =>
      events?.onToolCallStart?.(callId, info),
    onToolCallRequestNameReceived: (roundIndex, callId, name) =>
      events?.onToolCallName?.(callId, name),
    onToolCallRequestArgumentFragmentGenerated: (roundIndex, callId, fragment) =>
      events?.onToolCallFragment?.(callId, fragment),
    onToolCallRequestEnd: (roundIndex, callId, info) =>
      events?.onToolCallEnd?.(callId, info),
    onMessage: message => events?.onMessage?.(message),
    guardToolCall: async (roundIndex, callId, controller) => {
      const streamingToolCall = state.streamingToolCalls.find(
        tc => tc.toolCallId === controller.toolCallRequest.id
      );

      if (!streamingToolCall) {
        Logger.error("Could not find streaming tool call for guarding.");
        controller.deny("Internal error: Could not process tool call.");
        return;
      }

      const decision = await new Promise<"approved" | "denied">(resolve => {
        state.resolveConfirmation = resolve;
        setPendingToolCall(
          streamingToolCall.id,
          controller.toolCallRequest.arguments
        );
      });

      state.pendingToolCallConfirmation = null;
      state.resolveConfirmation = null;

      if (decision === "approved") {
        streamingToolCall.confirmationStatus = "approved";
        controller.allow();
      } else {
        streamingToolCall.confirmationStatus = "denied";
        controller.deny("User denied execution of the tool.");
      }
    }
  });

  state.currentAbortController = null;
  return true;
}
