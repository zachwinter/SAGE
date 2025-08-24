import { View, Chat } from "@/components/index.js";
import { useSnapshot } from "valtio";
import { state } from "@/threads/state/state.js";
import {
  interruptGeneration,
  removeLastMessage
} from "@/threads/messaging/actions.js";
import { KeyBinding } from "@/components/layout/View";

export const Home = () => {
  const snap = useSnapshot(state);

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
    }
  ];

  return (
    <View
      title="SAGE"
      keyBindings={keyBindings}
      showKeyBindings={false}
    >
      <Chat />
    </View>
  );
};
