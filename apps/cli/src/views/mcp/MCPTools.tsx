import { useMemo } from "react";
import { useSnapshot } from "valtio";
import { Box, Column, Row, Search, Text, View } from "../../components";
import { mcpState, McpTool } from "../../mcp";
import { MCPMenu, setView } from "../../router";

type CapabilityType = "tool" | "resource" | "prompt";

interface Capability {
  type: CapabilityType;
  name: string;
  description?: string;
  serverName: string;
  serverId: string;
  data: any;
}

export const MCPTools = () => {
  const snap = useSnapshot(mcpState);

  const handleInput = (_input: string, { escape }: { escape: boolean }) => {
    if (escape) setView(MCPMenu);
  };

  const capabilities: Capability[] = useMemo(() => {
    const allCapabilities: Capability[] = [];

    snap.availableTools.forEach((tool: McpTool) => {
      allCapabilities.push({
        type: "tool",
        name: tool.name,
        description: tool.description,
        serverName: tool.serverName,
        serverId: tool.serverId,
        data: tool
      });
    });

    snap.availableResources.forEach((resource: McpTool) => {
      allCapabilities.push({
        type: "resource",
        name: resource.name,
        description: resource.description,
        serverName: resource.serverName,
        serverId: resource.serverId,
        data: resource
      });
    });

    snap.availablePrompts.forEach((prompt: McpTool) => {
      allCapabilities.push({
        type: "prompt",
        name: prompt.name,
        description: prompt.description,
        serverName: prompt.serverName,
        serverId: prompt.serverId,
        data: prompt
      });
    });

    return allCapabilities;
  }, [snap.availableTools, snap.availableResources, snap.availablePrompts]);

  if (capabilities.length === 0) {
    return (
      <View
        title="MCP: Available Capabilities"
        onInput={handleInput}
      >
        <Column>
          <Text dimColor>No capabilities available</Text>
          <Text>
            Connect to MCP servers to see available tools, resources, and prompts
          </Text>
          <Text dimColor>(ESC) Return to MCP Menu</Text>
        </Column>
      </View>
    );
  }

  const renderCapability = (
    capability: Capability,
    isSelected: boolean,
    _index: number
  ) => {
    const getTypeDisplay = (type: CapabilityType) => {
      switch (type) {
        case "tool":
          return { icon: "🔧", color: "cyan" as const };
        case "resource":
          return { icon: "📁", color: "green" as const };
        case "prompt":
          return { icon: "💭", color: "yellow" as const };
      }
    };

    const { icon, color } = getTypeDisplay(capability.type);

    const getAdditionalInfo = () => {
      switch (capability.type) {
        case "tool":
          if (capability.data.inputSchema?.properties) {
            return `Parameters: ${Object.keys(capability.data.inputSchema.properties).join(", ")}`;
          }
          break;
        case "resource":
          if (capability.data.uri) {
            return `URI: ${capability.data.uri}`;
          }
          break;
        case "prompt":
          if (capability.data.arguments?.length > 0) {
            return `Arguments: ${capability.data.arguments.map((arg: any) => arg.name).join(", ")}`;
          }
          break;
      }
      return null;
    };

    return (
      <Box
        key={`${capability.serverId}-${capability.name}`}
        paddingLeft={1}
        borderStyle={isSelected ? "round" : undefined}
        borderColor={isSelected ? color : undefined}
      >
        <Column>
          <Row>
            <Text color={color}>
              {icon} {capability.name}
            </Text>
            <Text dimColor> (from {capability.serverName})</Text>
          </Row>
          <Text>{capability.description || "No description available"}</Text>
          {getAdditionalInfo() && <Text dimColor>{getAdditionalInfo()}</Text>}
        </Column>
      </Box>
    );
  };

  const filterFn = (capability: Capability, query: string) =>
    JSON.stringify({
      name: capability.name,
      description: capability.description,
      serverName: capability.serverName,
      type: capability.type
    })
      .toLowerCase()
      .includes(query.toLowerCase());

  return (
    <View
      title="MCP: Available Capabilities"
      onInput={handleInput}
    >
      <Search<Capability>
        filterFn={filterFn}
        collection={capabilities}
        placeholder={`filter ${capabilities.length} capabilities`}
        renderItem={renderCapability}
      />
    </View>
  );
};
