import { mcpState, defaultServerConfigs } from "../state/index.js";
import { mcpClientManager } from "../client/index.js";
import { McpServerConfig } from "../types.js";
import { validateServerConfig, normalizeServerConfig } from "./validation.js";
import { processServerConfigEnvVars } from "../env.js";
import {
  loadServerConfigs,
  saveServerConfigs,
  loadMcpJsonConfig
} from "./persistence.js";
import { syncFilesystemServers } from "../installation/index.js";
import { cleanupStalePidFiles } from "../process/index.js";

export async function initializeMcp(): Promise<void> {
  // Clean up stale PID files first
  cleanupStalePidFiles();

  // Try loading from both legacy format and standard mcp.json format first
  await loadServerConfigs();
  await loadMcpJsonConfig(undefined, addServerConfig);

  // Then scan for filesystem-installed servers and sync with configs
  await syncFilesystemServers();

  // Add default servers if none exist (but disabled by default)
  if (Object.keys(mcpState.serverConfigs).length === 0) {
    for (const config of defaultServerConfigs) {
      // Ensure default servers are disabled to prevent auto-connection errors
      const disabledConfig = { ...config, enabled: false };
      await addServerConfig(disabledConfig);
    }
  }

  // Initialize the client manager with loaded configurations
  for (const config of Object.values(mcpState.serverConfigs)) {
    try {
      await mcpClientManager.addServer(config);
    } catch (error) {
      console.warn(`Failed to add MCP server ${config.name}:`, error);
    }
  }

  await mcpClientManager.connectAll();
}

export async function addServerConfig(config: McpServerConfig): Promise<void> {
  // Process environment variables first
  const envResult = processServerConfigEnvVars(config);
  if (envResult.errors.length > 0) {
    throw new Error(`Environment variable errors: ${envResult.errors.join(", ")}`);
  }

  if (envResult.warnings.length > 0) {
    console.warn(
      `Environment variable warnings for ${config.name}:`,
      envResult.warnings
    );
  }

  const processedConfig = envResult.config;

  // Validate the configuration
  const validation = validateServerConfig(processedConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid server configuration: ${validation.errors.join(", ")}`);
  }

  if (validation.warnings.length > 0) {
    console.warn(
      `Server configuration warnings for ${config.name}:`,
      validation.warnings
    );
  }

  // Check for duplicate IDs
  if (mcpState.serverConfigs[processedConfig.id]) {
    throw new Error(`Server with ID "${processedConfig.id}" already exists`);
  }

  // Normalize and store the original configuration (with env vars unresolved for persistence)
  const normalizedConfig = normalizeServerConfig(config);
  if (!normalizedConfig) {
    throw new Error("Failed to normalize server configuration");
  }

  mcpState.serverConfigs[config.id] = normalizedConfig;
  mcpState.lastUpdated = Date.now();
  await saveServerConfigs();

  try {
    // Use the processed config (with resolved env vars) for the client manager
    await mcpClientManager.addServer(processedConfig);
  } catch (error) {
    console.warn(`Failed to add MCP server ${config.name}:`, error);
  }
}

export async function updateServerConfig(
  serverId: string,
  updates: Partial<McpServerConfig>
): Promise<void> {
  const existing = mcpState.serverConfigs[serverId];
  if (!existing) {
    throw new Error(`Server config ${serverId} not found`);
  }

  const wasEnabled = existing.enabled;
  const updatedConfig = { ...existing, ...updates };

  // Validate the updated configuration
  const validation = validateServerConfig(updatedConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid server configuration: ${validation.errors.join(", ")}`);
  }

  if (validation.warnings.length > 0) {
    console.warn(
      `Server configuration warnings for ${updatedConfig.name}:`,
      validation.warnings
    );
  }

  // Normalize and store the updated configuration
  const normalizedConfig = normalizeServerConfig(updatedConfig);
  if (!normalizedConfig) {
    throw new Error("Failed to normalize server configuration");
  }

  mcpState.serverConfigs[serverId] = normalizedConfig;
  mcpState.lastUpdated = Date.now();
  await saveServerConfigs();

  // Handle enabling/disabling
  if (!wasEnabled && normalizedConfig.enabled) {
    await mcpClientManager.connectServer(serverId);
  } else if (wasEnabled && !normalizedConfig.enabled) {
    await mcpClientManager.disconnectServer(serverId);
  }
}

export async function removeServerConfig(serverId: string): Promise<void> {
  if (!mcpState.serverConfigs[serverId]) {
    throw new Error(`Server config ${serverId} not found`);
  }

  await mcpClientManager.removeServer(serverId);
  delete mcpState.serverConfigs[serverId];
  mcpState.lastUpdated = Date.now();
  await saveServerConfigs();
}

export async function toggleServerEnabled(serverId: string): Promise<void> {
  const config = mcpState.serverConfigs[serverId];
  if (!config) {
    throw new Error(`Server config ${serverId} not found`);
  }

  await updateServerConfig(serverId, { enabled: !config.enabled });
}

/**
 * Get server status with detailed information
 */
export function getServerStatus(serverId: string) {
  const connection = mcpState.servers[serverId];
  if (!connection) return { status: "not_added", message: "Not added to runtime" };

  switch (connection.status) {
    case "connected":
      const capabilities = connection.capabilities;
      const toolCount = capabilities?.tools?.length || 0;
      const resourceCount = capabilities?.resources?.length || 0;
      const promptCount = capabilities?.prompts?.length || 0;
      return {
        status: "connected",
        message: `Connected (${toolCount} tools, ${resourceCount} resources, ${promptCount} prompts)`
      };
    case "connecting":
      return {
        status: "connecting",
        message: connection.error || "Connecting..."
      };
    case "error":
      return {
        status: "error",
        message: connection.error || "Connection error"
      };
    case "disconnected":
      return { status: "disconnected", message: "Disconnected" };
    default:
      return { status: "unknown", message: "Unknown status" };
  }
}

/**
 * Toggle server enabled status with error handling
 */
export async function toggleServerEnabledWithError(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await toggleServerEnabled(serverId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle server"
    };
  }
}

/**
 * Remove server config with error handling
 */
export async function removeServerConfigWithError(
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await removeServerConfig(serverId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove server"
    };
  }
}

/**
 * Convert servers to MultiSelectOption format
 */
export function serversToOptions() {
  const servers = Object.values(mcpState.serverConfigs);

  return servers.map(server => {
    const serverStatus = getServerStatus(server.id);

    return {
      label: server.name,
      value: server.id,
      selected: server.enabled,
      description:
        server.type === "stdio"
          ? `${server.command} ${server.args?.join(" ") || ""}`
          : server.url || "No URL configured",
      status: serverStatus.status as any,
      statusMessage: serverStatus.message
    };
  });
}
