import { useMemo } from "react";
import { useSnapshot } from "valtio";
import { state } from "@/threads/index.js";
import { getToolRequestMap, ThreadsState } from "@/threads/state/index.js";
import { ChatMessage } from "@lmstudio/sdk";
import { randomUUID } from "crypto";
import {
  Column,
  Message,
  UserMessage,
  AgentMessage,
  ToolCallRequest,
  Error
} from "@/components/index.js";
import { ToolCallConfirmation } from "./ToolCallConfirmation.js";
import Logger from "@/logger/logger.js";

const ids = new WeakMap<ChatMessage, string>();

export function keyForMessage(m: ChatMessage) {
  let k = ids.get(m);
  if (!k) {
    k = randomUUID();
    ids.set(m, k);
  }
  return k;
}

export const Chat = () => {
  const snap = useSnapshot<ThreadsState>(state);
  const messages =
    snap.active &&
    typeof snap.active === "object" &&
    typeof snap.active.getMessagesArray === "function"
      ? snap.active.getMessagesArray()
      : [];
  const allRequests = getToolRequestMap(snap as any);
  const streamingToolCallsWithKeys = useMemo(() => {
    if (!Array.isArray(snap.streamingToolCalls)) {
      return [];
    }
    return snap.streamingToolCalls.map(toolCall => ({
      ...toolCall,
      stableKey: toolCall.toolCallId
        ? `tool-${toolCall.toolCallId}`
        : `streaming-${toolCall.id}`
    }));
  }, [snap.streamingToolCalls]);

  const pendingConfirmationId = snap.pendingToolCallConfirmation?.id;

  return (
    <Column>
      {messages.map(message => {
        try {
          return (
            <Message
              message={message}
              key={keyForMessage(message)}
              allRequests={allRequests}
            />
          );
        } catch (error) {
          Logger.error("Error rendering message: " + (error as Error).message);
          return (
            <Error
              key={`error-${keyForMessage(message)}`}
              error="Failed to render message"
              compact
            />
          );
        }
      })}

      {snap.turn === "assistant" && (
        <Column paddingBottom={1}>
          {snap.response.length > 0 && <AgentMessage />}
          {streamingToolCallsWithKeys.map(toolCall => {
            const isPendingConfirmation = toolCall.id === pendingConfirmationId;

            if (isPendingConfirmation) {
              return (
                <ToolCallConfirmation
                  key={toolCall.stableKey}
                  toolCall={toolCall}
                />
              );
            }

            try {
              return (
                <ToolCallRequest
                  key={toolCall.stableKey}
                  name={toolCall.name || ""}
                  args={toolCall.arguments || ""}
                  hasError={toolCall.hasError}
                  errorMessage={toolCall.errorMessage}
                />
              );
            } catch (error) {
              Logger.error(
                "Error rendering streaming tool call: " + (error as Error).message
              );

              return (
                <Error
                  key={`error-${toolCall.stableKey}`}
                  error={`Failed to render tool call: ${toolCall.name || "unknown"}`}
                  compact
                />
              );
            }
          })}
        </Column>
      )}

      {!snap.pendingToolCallConfirmation && <UserMessage />}
    </Column>
  );
};
