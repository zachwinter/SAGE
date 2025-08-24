import { Column, Text } from "@/components/index.js";
import { ChatMessage } from "@lmstudio/sdk";
import { memo } from "react";

interface UserMessageProps {
  message: ChatMessage;
}

export const UserMessage = memo(({ message }: UserMessageProps) => {
  const text = message.getText() ?? "";

  if (!text) return null;

  return (
    <Column paddingBottom={1}>
      <Text bold dimColor>
        {text}
      </Text>
    </Column>
  );
});

UserMessage.displayName = "UserMessage";