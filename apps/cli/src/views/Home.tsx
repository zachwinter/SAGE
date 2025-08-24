import { useSnapshot } from "valtio";
import { Chat, View } from "../components/index";
import { KeyBinding } from "../components/layout/View";
import {
  interruptGeneration,
  removeLastMessage
} from "../threads/messaging/actions";
import { state } from "../threads/state/state";

export const Home = () => {
  const snap = useSnapshot(state, { sync: true });

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
