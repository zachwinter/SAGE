import { Box, Column, Row, Text, ToolCallRequest } from "@/components/index.js";
import { useInput } from "ink";
import { approveToolCall, denyToolCall } from "@/threads/messaging/actions.js";
import { type StreamingToolCall } from "@/threads/state/state.js";

interface ToolCallConfirmationProps {
  toolCall: StreamingToolCall;
}

export const ToolCallConfirmation = ({ toolCall }: ToolCallConfirmationProps) => {
  useInput((input, key) => {
    if (toolCall.confirmationStatus === "pending") {
      if (key.return || input.toLowerCase() === "y") {
        approveToolCall();
      } else if (key.escape || input.toLowerCase() === "n") {
        denyToolCall();
      }
    }
  });

  return (
    <Column>
      <ToolCallRequest
        name={toolCall.name || ""}
        args={toolCall.arguments || ""}
        hasError={toolCall.hasError}
        errorMessage={toolCall.errorMessage}
      />
      <Box
        borderColor="yellow"
        borderStyle="round"
        paddingX={1}
        marginTop={1}
      >
        <Row gap={2}>
          <Text
            color="yellow"
            bold
          >
            Approve?
          </Text>
          <Text dimColor>Yes [y/enter]</Text>
          <Text dimColor>No [n/esc]</Text>
        </Row>
      </Box>
    </Column>
  );
};
