import { useSnapshot } from "valtio";
import { View, type KeyBinding } from "../components/layout/View";
import * as models from "../models";
import {
  Home,
  SelectModel,
  SelectProvider,
  setView,
  Threads
} from "../router";
import * as threads from "../threads";

export const Menu = () => {
  const snap = useSnapshot(models.state);
  const currentModel = `(current: ${snap.selectedModel})`;
  const threadCount = `(${threads.state.saved.length} saved)`;
  const keyBindings: KeyBinding[] = [
    {
      key: "s",
      action: () => setView(SelectModel),
      label: `Select Model ${currentModel}`
    },
    {
      key: "p",
      action: () => setView(SelectProvider),
      label: "Providers"
    },
    {
      key: "t",
      label: `Threads ${threadCount}`,
      action: () => setView(Threads)
    },
    {
      key: "escape",
      action: () => setView(Home),
      label: "Return to Home"
    }
  ];

  return (
    <View
      title="Menu"
      keyBindings={keyBindings}
    />
  );
};
