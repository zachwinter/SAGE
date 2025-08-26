import { state as mcpState } from "./state.js";
import {
  McpServerConfig,
  McpServerConnection,
  McpTool,
  McpResource,
  McpPrompt
} from "../types.js";

export function getServerConfigs(): Record<string, McpServerConfig> {
  return mcpState.serverConfigs;
}

export function getServerConfig(serverId: string): McpServerConfig | undefined {
  return mcpState.serverConfigs[serverId];
}

export function getEnabledServerConfigs(): McpServerConfig[] {
  return Object.values(mcpState.serverConfigs).filter(
    (config: any) => config.enabled
  ) as McpServerConfig[];
}

export function getServerConnections(): Record<string, McpServerConnection> {
  return mcpState.servers;
}

export function getConnectedServers(): McpServerConnection[] {
  return Object.values(mcpState.servers).filter(
    (server: any) => server.status === "connected"
  ) as McpServerConnection[];
}

export function getServerConnection(
  serverId: string
): McpServerConnection | undefined {
  return mcpState.servers[serverId];
}

export function getAvailableMcpTools(): McpTool[] {
  return mcpState.availableTools;
}

export function getMcpToolByName(name: string): McpTool | undefined {
  return mcpState.availableTools.find((tool: McpTool) => tool.name === name);
}

export function getAvailableMcpResources(): McpResource[] {
  return mcpState.availableResources;
}

export function getMcpResourceByUri(uri: string): McpResource | undefined {
  return mcpState.availableResources.find(
    (resource: McpResource) => resource.uri === uri
  );
}

export function getAvailableMcpPrompts(): McpPrompt[] {
  return mcpState.availablePrompts;
}

export function getMcpPromptByName(name: string): McpPrompt | undefined {
  return mcpState.availablePrompts.find((prompt: McpPrompt) => prompt.name === name);
}

export function getServerStats() {
  const servers = Object.values(mcpState.servers);
  return {
    total: servers.length,
    connected: servers.filter((s: any) => s.status === "connected").length,
    connecting: servers.filter((s: any) => s.status === "connecting").length,
    error: servers.filter((s: any) => s.status === "error").length,
    disconnected: servers.filter((s: any) => s.status === "disconnected").length
  };
}

export function getCapabilityStats() {
  return {
    tools: mcpState.availableTools.length,
    resources: mcpState.availableResources.length,
    prompts: mcpState.availablePrompts.length
  };
}
