import { proxy } from "valtio";
import { McpState, McpServerConfig, McpServerConnection } from "../types.js";

export const state = proxy<McpState>({
  servers: {},
  serverConfigs: {},
  availableTools: [],
  availableResources: [],
  availablePrompts: [],
  isLoading: false,
  lastUpdated: Date.now(),
  selectedServer: null,
  searchState: {
    query: "",
    selectedIndex: 0,
    isSearchFocused: true
  },
  installationState: {
    status: {},
    loading: {}
  }
});

export function updateServerStatus(
  serverId: string,
  status: McpState["servers"][string]["status"],
  error?: string
) {
  const server = state.servers[serverId];
  if (server) {
    server.status = status;
    if (error) {
      server.error = error;
    } else {
      delete server.error;
    }
    if (status === "connected") {
      server.lastConnected = new Date();
    }
  }
}

export function updateServerCapabilities(
  serverId: string,
  capabilities: McpState["servers"][string]["capabilities"]
) {
  const server = state.servers[serverId];
  if (server) {
    server.capabilities = capabilities;
    refreshAvailableCapabilities();
  }
}

export function refreshAvailableCapabilities() {
  // Reset arrays
  state.availableTools.length = 0;
  state.availableResources.length = 0;
  state.availablePrompts.length = 0;

  // Aggregate from all connected servers
  for (const server of Object.values(state.servers)) {
    if (server.status === "connected" && server.capabilities) {
      if (server.capabilities.tools) {
        state.availableTools.push(
          ...server.capabilities.tools.map(tool => ({
            ...tool,
            serverId: server.id,
            serverName: server.name
          }))
        );
      }

      if (server.capabilities.resources) {
        state.availableResources.push(
          ...server.capabilities.resources.map(resource => ({
            ...resource,
            serverId: server.id,
            serverName: server.name
          }))
        );
      }

      if (server.capabilities.prompts) {
        state.availablePrompts.push(
          ...server.capabilities.prompts.map(prompt => ({
            ...prompt,
            serverId: server.id,
            serverName: server.name
          }))
        );
      }
    }
  }
}

export const defaultServerConfigs: McpServerConfig[] = [];

export function updateSearchQuery(query: string) {
  state.searchState.query = query;
  state.searchState.selectedIndex = 0; // Reset selection when query changes
}

export function setSearchSelectedIndex(index: number) {
  state.searchState.selectedIndex = index;
}

export function setSearchFocused(focused: boolean) {
  state.searchState.isSearchFocused = focused;
}

export function resetSearchState() {
  state.searchState.query = "";
  state.searchState.selectedIndex = 0;
  state.searchState.isSearchFocused = true;
}

export function viewMCPServer(server: McpServerConnection) {
  state.selectedServer = server;
}

export function setInstallStatus(status: Record<string, boolean>) {
  state.installationState.status = status;
}

export function setInstallLoading(serverName: string, loading: boolean) {
  state.installationState.loading[serverName] = loading;
}

export function updateInstallStatus(serverName: string, installed: boolean) {
  state.installationState.status[serverName] = installed;
}

// Legacy export for backward compatibility
export const mcpState = state;
