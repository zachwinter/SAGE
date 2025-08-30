import { Logger } from "@sage/utils";
import { useMemo } from "react";
import { useSnapshot } from "valtio";
import { Column, Error } from "../../components/index.js";
import { state, ThreadsState } from "../../threads/index.js";
import { AssistantTurn } from "./AssistantTurn.js";
import { ChatInput } from "./ChatInput.js";
import { UserMessage } from "./UserMessage.js";
import { normalizeStreamingToolCall } from "./utils/tool-call-utils.js";

const logger = new Logger("Chat");

interface ChatProps {
  startIndex?: number;
  endIndex?: number;
}

export const Chat = ({ startIndex = 0, endIndex }: ChatProps) => {
  const snap = useSnapshot<ThreadsState>(state, { sync: true });
  const messages =
    snap.active &&
    typeof snap.active === "object" &&
    typeof snap.active.getMessagesArray === "function"
      ? snap.active.getMessagesArray()
      : [];

  // Use provided endIndex or default to show all messages
  // const actualEndIndex = endIndex !== undefined ? endIndex : messages.length;

  // Slice messages based on provided indices
  const visibleMessages = messages;

  const streamingToolCalls = useMemo(() => {
    if (!Array.isArray(snap.streamingToolCalls)) {
      return [];
    }

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
        if (toolCall.toolCallId && completedToolCallIds.has(toolCall.toolCallId)) {
          logger.debug(
            `🚫 Filtering out completed tool call: ${toolCall.name} (${toolCall.toolCallId})`
          );
          return false;
        }

        return true;
      })
      .map(normalizeStreamingToolCall);
  }, [snap.streamingToolCalls, messages.length]);

  return (
    <Column gap={1}>
      {visibleMessages.map((message, idx) => {
        try {
          const role = message.getRole();
          // Calculate the actual index in the original messages array for keys
          const actualIndex = startIndex + idx;

          return role === "user" ? (
            <UserMessage
              key={`m-${actualIndex}`}
              message={message}
            />
          ) : (
            <AssistantTurn
              key={`m-${actualIndex}`}
              message={message}
            />
          );
        } catch (error) {
          logger.error("Error rendering message: " + (error as Error).message);
          return (
            <Error
              key={`error-m-${idx}`}
              error="Failed to render message"
              compact
            />
          );
        }
      })}

      {snap.turn === "assistant" && (
        <AssistantTurn
          key="streaming"
          streamingText={snap.response}
          streamingToolCalls={streamingToolCalls}
        />
      )}

      <ChatInput />
    </Column>
  );
};
