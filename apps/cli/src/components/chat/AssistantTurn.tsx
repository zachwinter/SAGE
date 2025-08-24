import { Column, Text } from "@/components/index.js";
import { ChatMessage } from "@lmstudio/sdk";
import { memo } from "react";
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
    // Get text content
    const messageText = message?.getText() ?? "";
    const displayText = streamingText || messageText;

    // Debug: Log the content we're about to render
    if (
      displayText ||
      streamingToolCalls?.length ||
      message?.getToolCallRequests()?.length
    ) {
      // console.log('AssistantTurn render:', {
      //   hasText: !!displayText,
      //   textLength: displayText?.length || 0,
      //   streamingTools: streamingToolCalls?.length || 0,
      //   completedTools: message?.getToolCallRequests()?.length || 0
      // });
    }

    // For completed messages, only show completed tool calls
    // For streaming turns, only show streaming tool calls
    let toolCallsToShow: UnifiedToolCall[] = [];

    if (message) {
      // This is a completed message - show its tool calls
      const requests = message.getToolCallRequests() ?? [];
      const results = message.getToolCallResults() ?? [];

      toolCallsToShow = requests.map(request => {
        const result = results.find(r => r.toolCallId === request.id);
        return normalizeStaticToolCall(request, result?.content);
      });
    } else {
      // This is a streaming turn - show streaming tool calls
      toolCallsToShow = streamingToolCalls;
    }

    return (
      <Column paddingBottom={1}>
        {/* Text content - ALWAYS render first */}
        {displayText && <Text>{displayText}</Text>}

        {/* Tool calls - ALWAYS render after text */}
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
