import { useState } from "react";
import { useSnapshot } from "valtio";
import {
  View,
  Text,
  Box,
  Column,
  SearchableMultiSelect
} from "@/components/index.js";
import { groupServersByRepo } from "@/mcp/utils/servers.js";
import {
  mcpState,
  toggleServerEnabledWithError,
  removeServerConfigWithError,
  serversToOptions
} from "@/mcp/index.js";

export const ManageMCP = () => {
  const [error, setError] = useState<string | null>(null);
  const snap = useSnapshot(mcpState);
  const servers = Object.values(snap.serverConfigs);
  const serverOptions = serversToOptions();

  const handleToggle = async (serverId: string) => {
    setError(null);
    const result = await toggleServerEnabledWithError(serverId);
    if (!result.success) setError(result.error!);
  };

  const handleRemove = async (serverId: string) => {
    setError(null);
    const result = await removeServerConfigWithError(serverId);
    if (!result.success) setError(result.error!);
  };

  if (servers.length === 0) {
    return (
      <View title="MCP: Manage Servers">
        <Text dimColor>No MCP servers configured</Text>
        <Text>Visit "Browse Server Registry" to discover and add servers</Text>
        <Text dimColor>(ESC) Return to MCP Menu</Text>
      </View>
    );
  }

  return (
    <View title="MCP: Manage Servers">
      <Column>
        {error && (
          <Box
            borderStyle="round"
            borderColor="red"
            paddingX={1}
            marginBottom={1}
          >
            <Text color="red">Error: {error}</Text>
          </Box>
        )}

        <SearchableMultiSelect
          options={serverOptions}
          onToggle={handleToggle}
          onRemove={handleRemove}
          placeholder={`manage ${servers.length} servers`}
          groupBy={groupServersByRepo}
          showInput={true}
        />

        <Text dimColor>(ESC) Return to MCP Menu</Text>
      </Column>
    </View>
  );
};
