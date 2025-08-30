import { useSnapshot } from "valtio";
import { Chat, View } from "../components/index";
import { KeyBinding } from "../components/layout/View";
import { useChatNavigation } from "../hooks/useChatNavigation";
import { interruptGeneration, removeLastMessage } from "../threads/messaging/actions";
import { state } from "../threads/state/state";

export const Home = () => {
  const snap = useSnapshot(state, { sync: true });

  // Get messages to determine count for navigation
  const messages =
    snap.active &&
    typeof snap.active === "object" &&
    typeof snap.active.getMessagesArray === "function"
      ? snap.active.getMessagesArray()
      : [];

  const { startIndex, endIndex, navigateUp, navigateDown, resetNavigation } =
    useChatNavigation(messages.length, 3);

  const keyBindings: KeyBinding[] = [
    {
      label: "Backspace",
      key: "delete",
      action: () => {
        if (snap.message.length === 0) {
          removeLastMessage();
        }
      }
    },
    {
      label: "Escape",
      key: "escape",
      action: () => {
        if (snap.turn === "assistant") {
          interruptGeneration();
        }
      }
    },
    {
      label: "Up Arrow",
      key: "up",
      action: () => {
        navigateUp();
      }
    },
    {
      label: "Down Arrow",
      key: "down",
      action: () => {
        navigateDown();
      }
    }
  ];

  return (
    <View
      title="SAGE"
      keyBindings={keyBindings}
      showKeyBindings={false}
    >
      <Chat
        startIndex={startIndex}
        endIndex={endIndex}
      />
    </View>
  );
};
