import { useSnapshot } from "valtio";
import { useEffect, useState } from "react";
import { MCPServer } from "@/mcp/types";
import { View, Search, MCPServerListItem, Error, Text } from "@/components/index.js";
import {
  initializeInstallationStatus,
  toggleServerInstallation,
  installServerFromRegistry,
  mcpRegistry
} from "@/mcp/index.js";
import {
  mcpState,
  updateSearchQuery,
  setSearchSelectedIndex,
  setSearchFocused
} from "@/mcp/index.js";

export const DiscoverMCP = () => {
  const snap = useSnapshot(mcpState);
  const [installError, setInstallError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    initializeInstallationStatus();
  }, []);

  const renderMCPServer = (
    server: MCPServer,
    isSelected: boolean,
    index: number
  ) => {
    const isInstalled = snap.installationState.status[server.name];
    const loading = snap.installationState.loading[server.name];

    return (
      <MCPServerListItem
        key={`${server.github}-${index}`}
        server={server}
        isSelected={isSelected}
        isInstalled={isInstalled}
        loading={loading}
      />
    );
  };

  const filterFn = ({ github, ...rest }: { github: string }) =>
    JSON.stringify(rest)
      .toLowerCase()
      .includes(snap.searchState.query.toLowerCase());

  const handleInstall = async (server: MCPServer) => {
    setInstallError(null);
    setSuccessMessage(null);
    try {
      const configs = await installServerFromRegistry(server);
      if (configs && configs.length > 0) {
        if (configs.length === 1) {
          setSuccessMessage(
            `${server.name} installed successfully! Visit 'Manage MCP' to enable it.`
          );
        } else {
          // For multiple servers, list them all
          const serverNames = configs.map(config => config.id).join(", ");
          setSuccessMessage(
            `Successfully installed ${configs.length} servers: ${serverNames}. Visit 'Manage MCP' to enable them.`
          );
        }
      } else {
        setSuccessMessage(
          `${server.name} installed successfully! Visit 'Manage MCP' to enable it.`
        );
      }
    } catch (error: any) {
      setInstallError(error.message);
    }
  };

  return (
    <View title="MCP: Discover">
      {installError && <Error error={installError} />}
      {successMessage && <Text color="green">{successMessage}</Text>}
      <Search<MCPServer>
        filterFn={filterFn}
        collection={mcpRegistry}
        onSelect={handleInstall}
        placeholder={`filter ${mcpRegistry.length} MCP servers`}
        renderItem={renderMCPServer}
        query={snap.searchState.query}
        onQueryChange={updateSearchQuery}
        selectedIndex={snap.searchState.selectedIndex}
        onSelectedIndexChange={setSearchSelectedIndex}
        isSearchFocused={snap.searchState.isSearchFocused}
        onSearchFocusChange={setSearchFocused}
      />
    </View>
  );
};
