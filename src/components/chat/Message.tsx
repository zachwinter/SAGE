import {
  ChatMessage,
  type ToolCallRequest as ToolCallRequestType
} from "@lmstudio/sdk";
import {
  Column,
  Text,
  ToolCallRequest,
  ToolCallResult
} from "@/components/index.js";
import { memo } from "react";

interface MessageProps {
  message: ChatMessage;
  allRequests?: Map<string, ToolCallRequestType>;
}

export const Message = memo(({ message, allRequests }: MessageProps) => {
  const text = message.getText() ?? "";
  const requests = message.getToolCallRequests() ?? [];
  const results = message.getToolCallResults() ?? [];
  const role = message.getRole();

  return (
    <Column paddingBottom={1}>
      {text && role === "user" && (
        <Text
          bold
          dimColor
        >
          {text}
        </Text>
      )}
      {text && role === "assistant" && <Text>{text}</Text>}

      {requests.map(r => (
        <ToolCallRequest
          key={`tool-${r.id}`}
          name={r.name}
          args={r.arguments}
        />
      ))}

      {results.map(result => {
        if (result?.toolCallId) {
          const request = allRequests?.get(result?.toolCallId);
          return (
            <ToolCallResult
              key={result.toolCallId}
              content={result.content}
              toolArgs={request?.arguments}
            />
          );
        }
        return null;
      })}
    </Column>
  );
});

Message.displayName = "Message";
