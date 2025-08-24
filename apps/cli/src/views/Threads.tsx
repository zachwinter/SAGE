import { View } from "../components/index";
import type { KeyBinding } from "../components/layout/View";
import { Home, setView } from "../router";

export const Threads = () => {
  const keyBindings: KeyBinding[] = [
    {
      key: "n",
      action: () => setView(Home),
      label: "Start New Thread"
    },
    {
      key: "escape",
      action: () => setView(Home),
      label: "Back to Home"
    }
  ];

  return (
    <View
      title="Threads"
      keyBindings={keyBindings}
    />
  );
};
