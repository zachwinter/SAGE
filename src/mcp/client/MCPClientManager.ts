import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "../types.js";
import {
  mcpState,
  updateServerStatus,
  updateServerCapabilities
} from "../state/index.js";
import Logger from "../../logger/logger.js";

interface ClientInfo {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
}

class MCPClientManager {
  private servers = new Map<string, McpServerConfig>();
  private clients = new Map<string, ClientInfo>();

  async addServer(config: McpServerConfig): Promise<void> {
    this.servers.set(config.id, config);
    if (!mcpState.servers[config.id]) {
      mcpState.servers[config.id] = {
        id: config.id,
        name: config.name,
        config: config,
        status: "disconnected"
      };
    }
  }

  async removeServer(serverId: string) {
    await this.disconnectServer(serverId);
    this.servers.delete(serverId);
    delete mcpState.servers[serverId];
  }

  async connectServer(serverId: string) {
    const config = this.servers.get(serverId);
    if (!config || !config.enabled) {
      return;
    }
    if (this.clients.has(serverId)) {
      return; // Already trying to connect or is connected.
    }

    Logger.info(`🔌 Attempting to connect to ${config.name}...`);
    updateServerStatus(serverId, "connecting");

    try {
      const client = new Client({
        name: `sage-cli-${serverId}`,
        version: "1.0.0"
      });

      let transport: StdioClientTransport | StreamableHTTPClientTransport;

      if (config.type === "http" && config.url) {
        // Use HTTP transport
        transport = new StreamableHTTPClientTransport(new URL(config.url));
        Logger.info(`Using HTTP transport for ${config.name} at ${config.url}`);
      } else {
        // Use stdio transport (default)
        if (!config.command) {
          throw new Error(`No command specified for stdio server ${config.name}`);
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: { ...process.env, ...config.env } as Record<string, any>,
          cwd: (config as any).cwd
        });
        Logger.info(
          `Using stdio transport for ${config.name}: ${config.command} ${config.args?.join(" ") || ""}`
        );
      }

      this.clients.set(serverId, { client, transport });
      await client.connect(transport);
      Logger.info(`✅ Connection established with ${config.name}!`);
      mcpState.servers[serverId].client = client;
      updateServerStatus(serverId, "connected");
      // Fetch real capabilities from the connected server!
      Logger.info(`🔍 Fetching capabilities from ${config.name}...`);

      try {
        const results = await Promise.allSettled([
          client.listTools(),
          client.listResources(),
          client.listPrompts()
        ]);

        const toolsResult =
          results[0].status === "fulfilled" ? results[0].value : { tools: [] };
        const resourcesResult =
          results[1].status === "fulfilled" ? results[1].value : { resources: [] };
        const promptsResult =
          results[2].status === "fulfilled" ? results[2].value : { prompts: [] };

        const capabilities = {
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || []
        };

        Logger.info(
          `✅ Successfully fetched ${capabilities.tools.length} tools, ${capabilities.resources.length} resources, ${capabilities.prompts.length} prompts from ${config.name}!`
        );
        updateServerCapabilities(serverId, capabilities);
      } catch (error) {
        Logger.error(
          `❌ Critical error fetching capabilities from ${config.name}:`,
          error
        );
        // Set empty capabilities but don't fail the connection
        const emptyCapabilities = { tools: [], resources: [], prompts: [] };
        updateServerCapabilities(serverId, emptyCapabilities);
      }
    } catch (error: any) {
      Logger.error(`❌ Failed to connect to server ${serverId}:`, error.message);
      updateServerStatus(serverId, "error", error.message);
      this.clients.delete(serverId); // Clean up failed attempt
    }
  }

  async disconnectServer(serverId: string) {
    const clientInfo = this.clients.get(serverId);
    if (clientInfo) {
      Logger.info(`🔌 Disconnecting from ${mcpState.servers[serverId]?.name}...`);
      await clientInfo.transport.close();
      this.clients.delete(serverId);
    }
    if (mcpState.servers[serverId]) {
      updateServerStatus(serverId, "disconnected");
      delete mcpState.servers[serverId].client;
    }
  }

  async connectAll() {
    for (const [serverId, config] of this.servers) {
      if (config.enabled) {
        await this.connectServer(serverId);
      }
    }
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    const clientInfo = this.clients.get(serverId);
    if (!clientInfo) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const server = mcpState.servers[serverId];
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    Logger.info(`🔧 Calling tool ${toolName} on server ${server.name}...`);

    try {
      const { client } = clientInfo;
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      Logger.info(`✅ Tool ${toolName} executed successfully`);
      return result;
    } catch (error: any) {
      Logger.error(
        `❌ Failed to call tool ${toolName} on server ${serverId}:`,
        error.message
      );
      throw error;
    }
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const clientInfo = this.clients.get(serverId);
    if (!clientInfo) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const server = mcpState.servers[serverId];
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    Logger.info(`📄 Reading resource ${uri} from server ${server.name}...`);

    try {
      const result = await clientInfo.client.readResource({ uri });
      Logger.info(`✅ Resource ${uri} read successfully`);
      return result;
    } catch (error: any) {
      Logger.error(
        `❌ Failed to read resource ${uri} from server ${serverId}:`,
        error.message
      );
      throw error;
    }
  }

  async getPrompt(
    serverId: string,
    name: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    const clientInfo = this.clients.get(serverId);
    if (!clientInfo) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const server = mcpState.servers[serverId];
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    Logger.info(`💬 Getting prompt ${name} from server ${server.name}...`);

    try {
      const result = await clientInfo.client.getPrompt({
        name,
        arguments: args
      });

      Logger.info(`✅ Prompt ${name} retrieved successfully`);
      return result;
    } catch (error: any) {
      Logger.error(
        `❌ Failed to get prompt ${name} from server ${serverId}:`,
        error.message
      );
      throw error;
    }
  }
}

export { MCPClientManager };
export const mcpClientManager = new MCPClientManager();
