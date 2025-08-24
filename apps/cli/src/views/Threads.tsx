import { View } from "@/components/index.js";
import { setView, Home } from "@/router/index.js";
import type { KeyBinding } from "@/components/layout/View.js";

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
