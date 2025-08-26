import { ChatMessage } from "@lmstudio/sdk";
import { Text } from "../../components";

interface UserMessageProps {
  message: ChatMessage;
}

export const UserMessage = ({ message }: UserMessageProps) => {
  const text = message.getText() ?? "";
  return <Text dimColor>{text}</Text>;
};
