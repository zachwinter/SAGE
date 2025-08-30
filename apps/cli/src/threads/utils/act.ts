import { Chat } from "@lmstudio/sdk";
import { Logger } from "@sage/utils";
import { getSelectedModel } from "../../models";
import { toolRegistry } from "@sage/tools";
import { setPendingToolCall } from "../messaging/actions.js";
import {
  getGlobalAbortController,
  setGlobalAbortController,
  state
} from "../state/state.js";
import { clearAllStreamingToolCalls } from "../streaming";
const logger = new Logger("threads:utils:act", "debug.log");

export async function act(chat: Chat, events: any) {
  logger.info("=== ACT FUNCTION STARTED ===");
  logger.info(`🔍 Current turn state: ${state.turn}`);
  logger.info(`🔍 Pending confirmation: ${!!state.resolveConfirmation}`);
  logger.info(
    `🔍 Active streaming tool calls: ${state.streamingToolCalls?.length || 0}`
  );

  setGlobalAbortController(new AbortController());

  const model = await getSelectedModel();

  if (!model) {
    logger.error("No model selected");
    return console.error("No model selected.");
  }

  logger.info(`Using model: ${model.constructor.name}`);

  try {
    await model.act(chat, toolRegistry.getLMStudioTools(), {
      signal: getGlobalAbortController()!.signal,
      onRoundStart: roundIndex => {
        logger.info(`🔄 Round ${roundIndex} started`);
        events?.onRoundStart?.(roundIndex);
      },
      onRoundEnd: roundIndex => {
        logger.info(`✅ Round ${roundIndex} ended`);
        events?.onRoundEnd?.(roundIndex);
      },
      onPredictionFragment: data => events?.onContentFragment?.(data),
      onPredictionCompleted: data => events?.onComplete?.(data),
      onToolCallRequestStart: (roundIndex, callId, info) => {
        logger.info(
          `🔧 Tool call started: round=${roundIndex}, callId=${callId}, toolCallId=${info.toolCallId}`
        );
        events?.onToolCallStart?.(callId, info);
      },
      onToolCallRequestNameReceived: (roundIndex, callId, name) => {
        logger.info(`🏷️  Tool call name: callId=${callId}, name=${name}`);
        events?.onToolCallName?.(callId, name);
      },
      onToolCallRequestArgumentFragmentGenerated: (roundIndex, callId, fragment) => {
        logger.info(
          `📝 Fragment received: callId=${callId}, length=${fragment?.length || 0}`
        );
        events?.onToolCallFragment?.(callId, fragment);
      },
      onToolCallRequestEnd: (roundIndex, callId, info) => {
        logger.info(
          `🏁 Tool call ended: callId=${callId}, toolCallId=${info.toolCallId || "undefined"}`
        );
        events?.onToolCallEnd?.(callId, info);
      },
      onMessage: message => {
        logger.info(`💬 Message received: ${JSON.stringify(message.getRole())}`);
        events?.onMessage?.(message);
      },
      guardToolCall: async (roundIndex, callId, controller) => {
        logger.info(
          `🛡️  GuardToolCall: round=${roundIndex}, callId=${callId}, toolCallId=${controller.toolCallRequest.id}`
        );
        logger.info(
          `🛡️  Tool request: ${controller.toolCallRequest.name}(${JSON.stringify(controller.toolCallRequest.arguments).substring(0, 100)}...)`
        );

        const streamingToolCall = state.streamingToolCalls.find(
          tc => tc.toolCallId === controller.toolCallRequest.id
        );

        if (!streamingToolCall) {
          logger.error(
            `🚫 Could not find streaming tool call for guarding. ToolCallId=${controller.toolCallRequest.id}`
          );
          logger.info(
            `🚫 Available streaming tool calls: ${JSON.stringify(state.streamingToolCalls.map(tc => ({ id: tc.id, toolCallId: tc.toolCallId, name: tc.name })))}`
          );
          controller.deny("Internal error: Could not process tool call.");
          return;
        }

        logger.info(
          `⏳ Waiting for user confirmation for tool call: ${controller.toolCallRequest.name}`
        );

        const decision =
          controller.toolCallRequest.name === "GraphQuery" ||
          controller.toolCallRequest.name === "Read"
            ? "approved"
            : await new Promise<"approved" | "denied">(resolve => {
                state.resolveConfirmation = resolve;
                setPendingToolCall(
                  streamingToolCall.id,
                  controller.toolCallRequest.arguments
                );
              });

        logger.info(`📋 User decision: ${decision}`);

        state.pendingToolCallConfirmation = null;
        state.resolveConfirmation = null;

        if (decision === "approved") {
          streamingToolCall.confirmationStatus = "approved";
          logger.info(`🔓 About to call controller.allow()`);
          controller.allow();
          logger.info(`✅ Tool call approved and allowed`);
        } else {
          streamingToolCall.confirmationStatus = "denied";
          logger.info(`🔓 About to call controller.deny()`);
          controller.deny("User denied execution of the tool.");
          logger.info(`❌ Tool call denied - aborting current round`);
          getGlobalAbortController()?.abort();
        }
        logger.info(
          `🏁 GuardToolCall completed for ${controller.toolCallRequest.name}`
        );
      }
    });
  } catch (error) {
    logger.error(
      `💥 Error in act function: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }

  clearAllStreamingToolCalls();
  return true;
}
