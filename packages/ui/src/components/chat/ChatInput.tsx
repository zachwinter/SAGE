import { useInput } from "ink";
import { useSnapshot } from "valtio";
import { Column, Row, Text, TextInput } from "../../components/index.js";
import { theme } from "../../config/index.js";
import * as models from "../../models/index.js";
import * as threads from "../../threads/index.js";
import { getGlobalAbortController, setTurn } from "../../threads/index.js";
export const ChatInput = () => {
  const threadsSnap = useSnapshot(threads.state, { sync: true });
  const modelsSnap = useSnapshot(models.state);
  const totalMessages = threadsSnap.active?.getLength?.() || 0;
  const [prefix, suffix] =
    typeof modelsSnap.selectedModel === "string"
      ? modelsSnap.selectedModel.split("/")
      : [null, null];

  const pendingConfirmationId = threadsSnap.pendingToolCallConfirmation?.id;

  useInput((input, key) => {
    // Handle tool call confirmation
    if (threadsSnap.resolveConfirmation) {
      if (input.toLowerCase() === "y" || key.return) {
        threads.approveToolCall();
        return;
      } else if (input.toLowerCase() === "n" || key.escape) {
        threads.denyToolCall();
        return;
      }
    }

    // Handle assistant interruption
    if (key.escape && threadsSnap.turn === "assistant") {
      getGlobalAbortController()?.abort?.();
      setTurn("user");
    }
  });

  const handleSubmit = (value: string) => {
    // Don't send messages during tool confirmation or when assistant is active
    if (threadsSnap.resolveConfirmation || threadsSnap.turn === "assistant") {
      return;
    }
    threads.sendMessage();
  };

  return (
    <Column>
      <TextInput
        placeholder={
          pendingConfirmationId
            ? `CONFIRM ${threadsSnap.pendingToolCallConfirmation.name} ? (Y/n)`
            : threadsSnap.turn === "user"
              ? "send a message"
              : "hit ESC to interrupt"
        }
        value={threadsSnap.message}
        setValue={threads.setMessage}
        onSubmit={handleSubmit}
        isConfirmationMode={!!pendingConfirmationId}
      />

      <Row
        justifyContent="space-between"
        alignItems="center"
      >
        <Row gap={1}>
          <Text color={theme.primary}>≡</Text>
          <Text>
            SHIFT<Text color="gray">+</Text>TAB
          </Text>
        </Row>
        <Row gap={3}>
          <Row>
            <Text dimColor>{prefix}</Text>
            <Text dimColor>/</Text>
            <Text>{suffix}</Text>
          </Row>
          <Row gap={1}>
            <Text>{totalMessages}</Text>
            <Text dimColor>msg(s) in thread</Text>
          </Row>
        </Row>
      </Row>
    </Column>
  );
};
