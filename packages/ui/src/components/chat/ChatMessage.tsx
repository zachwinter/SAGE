import { Column, Text } from "@/components/index.js";
import { ChatMessage } from "@lmstudio/sdk";
import { memo } from "react";

interface ChatMessageProps {
  message: ChatMessage;
}

export const ChatMessageComponent = memo(({ message }: ChatMessageProps) => {
  const text = message.getText() ?? "";
  const role = message.getRole();

  // Only render text content - tool calls are handled separately
  if (!text) return null;

  return (
    <Column paddingBottom={1}>
      {role === "user" && (
        <Text
          bold
          dimColor
        >
          {text}
        </Text>
      )}
      {role === "assistant" && <Text>{text}</Text>}
    </Column>
  );
});

ChatMessageComponent.displayName = "ChatMessage";
