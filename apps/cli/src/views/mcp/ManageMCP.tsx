import { useState } from "react";
import { useSnapshot } from "valtio";
import { Box, Column, SearchableMultiSelect, Text, View } from "../../components";
import { theme } from "../../config";
import {
  mcpState,
  removeServerConfigWithError,
  serversToOptions,
  toggleServerEnabledWithError
} from "@sage/mcp";
import { groupServersByRepo } from "@sage/mcp";
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
            borderStyle={theme.border as any}
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
