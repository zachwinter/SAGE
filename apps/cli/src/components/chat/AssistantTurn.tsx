import { ChatMessage } from "@lmstudio/sdk";
import { memo } from "react";
import { Column, Text } from "../../components";
import { ToolCall } from "./ToolCall.js";
import {
  generateToolCallKey,
  normalizeStaticToolCall,
  type UnifiedToolCall
} from "./utils/tool-call-utils.js";

interface AssistantTurnProps {
  message?: ChatMessage;
  streamingText?: string;
  streamingToolCalls?: UnifiedToolCall[];
  allRequests?: Map<string, any>;
}

export const AssistantTurn = memo(
  ({
    message,
    streamingText,
    streamingToolCalls = [],
    allRequests
  }: AssistantTurnProps) => {
    const messageText = message?.getText() ?? "";
    const displayText = streamingText || messageText;

    let toolCallsToShow: UnifiedToolCall[] = [];

    if (message) {
      const requests = message.getToolCallRequests() ?? [];
      const results = message.getToolCallResults() ?? [];

      toolCallsToShow = requests.map(request => {
        const result = results.find(r => r.toolCallId === request.id);
        return normalizeStaticToolCall(request, result?.content);
      });
    } else {
      toolCallsToShow = streamingToolCalls;
    }

    return (
      <Column paddingBottom={1}>
        {displayText && <Text>{displayText}</Text>}
        {toolCallsToShow.map(toolCall => (
          <ToolCall
            key={generateToolCallKey(toolCall)}
            toolCall={toolCall}
          />
        ))}
      </Column>
    );
  }
);

AssistantTurn.displayName = "AssistantTurn";
