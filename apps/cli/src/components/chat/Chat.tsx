import { ChatMessage } from "@lmstudio/sdk";
import { Logger } from "@sage/utils";
import { randomUUID } from "crypto";
import { useMemo } from "react";
import { useSnapshot } from "valtio";
import { Column, Error } from "../../components/index.js";
import { getToolRequestMap, state, ThreadsState } from "../../threads/index.js";
import { AssistantTurn } from "./AssistantTurn.js";
import { ChatInput } from "./ChatInput.js";
import { UserMessage } from "./UserMessage.js";
import { normalizeStreamingToolCall } from "./utils/tool-call-utils.js";

const logger = new Logger("Chat");
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
  const snap = useSnapshot<ThreadsState>(state, { sync: true });
  const messages =
    snap.active &&
    typeof snap.active === "object" &&
    typeof snap.active.getMessagesArray === "function"
      ? snap.active.getMessagesArray()
      : [];
  const allRequests = getToolRequestMap(snap as any);

  // Process streaming tool calls with proper deduplication
  const streamingToolCalls = useMemo(() => {
    if (!Array.isArray(snap.streamingToolCalls)) {
      return [];
    }

    // Get all completed tool call IDs from messages to avoid duplicates
    const completedToolCallIds = new Set<string>();
    messages.forEach(message => {
      const requests = message.getToolCallRequests() ?? [];
      requests.forEach(req => {
        if (req.id) {
          completedToolCallIds.add(req.id);
        }
      });
    });

    return snap.streamingToolCalls
      .filter(toolCall => {
        // Skip approved tool calls (they'll be in messages soon)
        if (toolCall.confirmationStatus === "approved") {
          logger.debug(`🚫 Filtering out approved tool call: ${toolCall.name}`);
          return false;
        }

        // Skip if this streaming tool call is already completed and in messages
        if (toolCall.toolCallId && completedToolCallIds.has(toolCall.toolCallId)) {
          logger.debug(
            `🚫 Filtering out completed tool call: ${toolCall.name} (${toolCall.toolCallId})`
          );
          return false;
        }

        return true;
      })
      .map(normalizeStreamingToolCall);
  }, [snap.streamingToolCalls, messages]);

  return (
    <Column>
      {/* Render all completed messages */}
      {messages.map(message => {
        try {
          const role = message.getRole();

          return role === "user" ? (
            <UserMessage
              key={keyForMessage(message)}
              message={message}
            />
          ) : (
            <AssistantTurn
              key={keyForMessage(message)}
              message={message}
              allRequests={allRequests}
            />
          );
        } catch (error) {
          logger.error("Error rendering message: " + (error as Error).message);
          return (
            <Error
              key={`error-${keyForMessage(message)}`}
              error="Failed to render message"
              compact
            />
          );
        }
      })}

      {/* Render current assistant turn (streaming) */}
      {snap.turn === "assistant" &&
        (snap.response || streamingToolCalls.length > 0) &&
        !snap.resolveConfirmation && (
          <AssistantTurn
            streamingText={snap.response}
            streamingToolCalls={streamingToolCalls}
          />
        )}

      {/* Chat input with confirmation logic */}
      <ChatInput />
    </Column>
  );
};
