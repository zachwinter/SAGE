import { View } from "@/components/index.js";
import { KeyBinding } from "@/components/layout/View";
import { setView, Menu, DiscoverMCP, ManageMCP, MCPTools } from "@/router/index.js";

const keyBindings: KeyBinding[] = [
  {
    key: "v",
    action: () => setView(ManageMCP),
    label: "View Active Servers"
  },
  {
    key: "b",
    action: () => setView(DiscoverMCP),
    label: "Browse Server Registry"
  },
  {
    key: "t",
    action: () => setView(MCPTools),
    label: "Tools & Capabilities"
  },
  {
    key: "escape",
    action: () => setView(Menu),
    label: "Return to Menu"
  }
];

export const MCPMenu = () => (
  <View
    title="MCP"
    keyBindings={keyBindings}
  />
);
