import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool, Resource, Prompt } from "@modelcontextprotocol/sdk/types.js";

export type MCPServer = {
  name: string;
  github: string;
  description: string;
  short_description: string;
  tags: string[];
};

export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "http" | "adapter";
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  env?: Record<string, string>;
  transportPreference?: "http" | "stdio";
  adapterConfig?: {
    originalType: "stdio" | "http";
    adapterPort?: number;
    useStdioAdapter?: boolean;
  };
}

export interface McpServerConnection {
  id: string;
  name: string;
  config: McpServerConfig;
  client?: Client;
  status: "connecting" | "connected" | "disconnected" | "error";
  error?: string;
  capabilities?: {
    tools?: Tool[];
    resources?: Resource[];
    prompts?: Prompt[];
  };
  lastConnected?: Date;
}

export interface McpState {
  servers: Record<string, McpServerConnection>;
  serverConfigs: Record<string, McpServerConfig>;
  availableTools: McpTool[];
  availableResources: McpResource[];
  availablePrompts: McpPrompt[];
  isLoading: boolean;
  lastUpdated: number;
  selectedServer: McpServerConnection | null;
  searchState: {
    query: string;
    selectedIndex: number;
    isSearchFocused: boolean;
  };
  installationState: {
    status: Record<string, boolean>;
    loading: Record<string, boolean>;
  };
}

export interface McpTool extends Tool {
  serverId: string;
  serverName: string;
}

export interface McpResource extends Resource {
  serverId: string;
  serverName: string;
}

export interface McpPrompt extends Prompt {
  serverId: string;
  serverName: string;
}

export type McpTransportType = "stdio" | "http" | "adapter";

// Standard MCP JSON configuration format
export interface McpJsonServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface McpJsonConfig {
  mcpServers: Record<string, McpJsonServerConfig>;
}

// Helper to convert between our internal format and standard MCP JSON format
export function mcpJsonToServerConfig(
  name: string,
  jsonConfig: McpJsonServerConfig
): McpServerConfig {
  const hasUrl = Boolean(jsonConfig.url);
  const hasCommand = Boolean(jsonConfig.command);

  // Determine transport preference: prefer HTTP if URL is available
  const transportPreference: "http" | "stdio" = hasUrl ? "http" : "stdio";

  return {
    id: name,
    name: name,
    type: hasUrl ? "http" : "stdio",
    command: jsonConfig.command,
    args: jsonConfig.args,
    url: jsonConfig.url,
    enabled: true, // Default to enabled when imported from mcp.json
    env: jsonConfig.env,
    transportPreference,
    // Set up adapter config for stdio servers that could benefit from HTTP adapter
    adapterConfig:
      !hasUrl && hasCommand
        ? {
            originalType: "stdio",
            useStdioAdapter: true
          }
        : undefined
  };
}

export function serverConfigToMcpJson(config: McpServerConfig): McpJsonServerConfig {
  const jsonConfig: McpJsonServerConfig = {};
  const effectiveType =
    config.type === "adapter"
      ? config.adapterConfig?.originalType || "stdio"
      : config.type;

  if (effectiveType === "stdio" || config.type === "adapter") {
    if (config.command) jsonConfig.command = config.command;
    if (config.args) jsonConfig.args = config.args;
  } else if (effectiveType === "http") {
    if (config.url) jsonConfig.url = config.url;
  }

  if (config.env) jsonConfig.env = config.env;

  return jsonConfig;
}
