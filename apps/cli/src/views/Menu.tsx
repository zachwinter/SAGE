import { setView, SelectModel, Home, MCPMenu, Threads } from "@/router/index.js";
import { View, type KeyBinding } from "@/components/layout/View.js";
import * as models from "@/models/index.js";
import * as threads from "@/threads/index.js";
import { useSnapshot } from "valtio";

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
      key: "t",
      label: `Threads ${threadCount}`,
      action: () => setView(Threads)
    },
    {
      key: "m",
      action: () => setView(MCPMenu),
      label: "MCP Servers"
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
