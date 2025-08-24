import { View } from "../../components";
import { KeyBinding } from "../../components/layout/View";
import { DiscoverMCP, ManageMCP, MCPTools, Menu, setView } from "../../router";

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
