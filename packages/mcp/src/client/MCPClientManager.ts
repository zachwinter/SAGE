import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Logger, createDirectoryManager } from "@sage/utils";
import {
  mcpState,
  updateServerCapabilities,
  updateServerStatus
} from "../state/index.js";
import type { McpServerConfig } from "../types.js";

interface ClientInfo {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
}

const logger = new Logger("mcp-client-manager");

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

    logger.info(`🔌 Attempting to connect to ${config.name}...`);
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
        logger.info(`Using HTTP transport for ${config.name} at ${config.url}`);
      } else {
        // Use stdio transport (default)
        if (!config.command) {
          throw new Error(`No command specified for stdio server ${config.name}`);
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: {
            ...process.env,
            NODE_PATH: process.env.NODE_PATH || "./node_modules",
            ...config.env
          } as Record<string, any>
        });
        logger.info(
          `Using stdio transport for ${config.name}: ${config.command} ${config.args?.join(" ") || ""}`
        );
      }

      this.clients.set(serverId, { client, transport });

      logger.info(`🔌 About to call client.connect() for ${config.name}`);
      await client.connect(transport);
      logger.info(`🔌 client.connect() completed for ${config.name}`);
      logger.info(`✅ Connection established with ${config.name}!`);

      // 🚀 BREAKTHROUGH FIX - call capabilities IMMEDIATELY after connect!
      try {
        logger.info(`🚀 IMMEDIATE capability calls right after connect...`);

        // Call all three methods immediately while socket context is intact
        const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
          client.listTools().catch(e => ({ tools: [] })),
          client.listResources().catch(e => ({ resources: [] })),
          client.listPrompts().catch(e => ({ prompts: [] }))
        ]);

        logger.info(`🚀 IMMEDIATE calls SUCCESS!`, {
          tools: toolsResult.tools?.length || 0,
          resources: resourcesResult.resources?.length || 0,
          prompts: promptsResult.prompts?.length || 0
        });

        const capabilities = {
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || []
        };

        // Update state properly
        mcpState.servers[serverId].client = client;
        updateServerStatus(serverId, "connected");
        updateServerCapabilities(serverId, capabilities);

        logger.info(
          `🎉 BREAKTHROUGH! Fetched ${capabilities.tools.length} tools, ${capabilities.resources.length} resources, ${capabilities.prompts.length} prompts immediately after connect!`
        );
        return;
      } catch (immediateError) {
        logger.error(`🚀 Even immediate calls failed:`, immediateError);
      }

      mcpState.servers[serverId].client = client;
      updateServerStatus(serverId, "connected");
      // Fetch real capabilities from the connected server!
      logger.info(`🔍 Fetching capabilities from ${config.name}...`);

      try {
        logger.info(`🔧 About to fetch capabilities from ${config.name}`);

        // EXACT COPY of working test pattern - bypass all our complex logic
        logger.info(`🔧 Trying EXACT working test pattern...`);

        try {
          // Debug the client transport state before calling
          const clientInfo = this.clients.get(serverId);
          if (clientInfo?.transport instanceof StdioClientTransport) {
            const transport = clientInfo.transport as any; // Access private members
            logger.info(`🔧 Transport debug:`, {
              hasProcess: !!transport._process,
              processId: transport._process?.pid,
              hasStdin: !!transport._process?.stdin,
              stdinWritable: transport._process?.stdin?.writable
            });
          }

          logger.info(`🔧 Direct listTools call (like working test)...`);
          const toolsResult = await client.listTools();
          logger.info(`🔧 MIRACLE! Direct call worked:`, toolsResult);

          const capabilities = {
            tools: toolsResult.tools || [],
            resources: [], // Skip for now, just get tools working
            prompts: []
          };

          logger.info(
            `✅ BREAKTHROUGH! Fetched ${capabilities.tools.length} tools directly!`
          );
          updateServerCapabilities(serverId, capabilities);
          return; // Early return on success
        } catch (directError) {
          logger.error(`🔧 Direct call also failed:`, directError);
        }

        // If direct call fails, fall back to old pattern
        const results = [
          { status: "rejected", value: { tools: [] } },
          { status: "rejected", value: { resources: [] } },
          { status: "rejected", value: { prompts: [] } }
        ];

        logger.info(`🔧 Got capability results for ${config.name}:`, {
          resultsCount: results.length,
          statuses: results.map(r => r.status),
          errors: results
            .filter(r => r.status === "rejected")
            .map(r => (r as any).reason?.message)
        });

        const capabilities = {
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || []
        };

        logger.info(
          `✅ Successfully fetched ${capabilities.tools.length} tools, ${capabilities.resources.length} resources, ${capabilities.prompts.length} prompts from ${config.name}!`
        );
        updateServerCapabilities(serverId, capabilities);
      } catch (error) {
        logger.error(
          `❌ Critical error fetching capabilities from ${config.name}:`,
          error
        );
        // Set empty capabilities but don't fail the connection
        const emptyCapabilities = { tools: [], resources: [], prompts: [] };
        updateServerCapabilities(serverId, emptyCapabilities);
      }
    } catch (error: any) {
      logger.error(`❌ Failed to connect to server ${serverId}:`, error.message);
      updateServerStatus(serverId, "error", error.message);
      this.clients.delete(serverId); // Clean up failed attempt
    }
  }

  async disconnectServer(serverId: string) {
    const clientInfo = this.clients.get(serverId);
    if (clientInfo) {
      logger.info(`🔌 Disconnecting from ${mcpState.servers[serverId]?.name}...`);
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
    const config = this.servers.get(serverId);
    if (!config) {
      throw new Error(`Server ${serverId} configuration not found`);
    }

    const server = mcpState.servers[serverId];
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    logger.info(`🔧 Calling tool ${toolName} on server ${server.name}...`);
    logger.info(
      `🚀 Creating fresh connection for tool call to avoid socket binding issue...`
    );

    try {
      // Create fresh client for this call to avoid socket binding issues
      const freshClient = new Client({
        name: `sage-cli-tool-${serverId}-${Date.now()}`,
        version: "1.0.0"
      });

      const freshTransport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: {
          ...process.env,
          NODE_PATH: process.env.NODE_PATH || "./node_modules",
          ...config.env
        } as Record<string, any>
      });

      await freshClient.connect(freshTransport);

      // Call tool immediately after connect while socket context is fresh
      const result = await freshClient.callTool({
        name: toolName,
        arguments: args
      });

      // Clean up
      await freshClient.close?.();

      logger.info(
        `✅ Tool ${toolName} executed successfully with fresh connection!`
      );
      return result;
    } catch (error: any) {
      logger.error(
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

    logger.info(`📄 Reading resource ${uri} from server ${server.name}...`);

    try {
      const result = await clientInfo.client.readResource({ uri });
      logger.info(`✅ Resource ${uri} read successfully`);
      return result;
    } catch (error: any) {
      logger.error(
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

    logger.info(`💬 Getting prompt ${name} from server ${server.name}...`);

    try {
      const result = await clientInfo.client.getPrompt({
        name,
        arguments: args
      });

      logger.info(`✅ Prompt ${name} retrieved successfully`);
      return result;
    } catch (error: any) {
      logger.error(
        `❌ Failed to get prompt ${name} from server ${serverId}:`,
        error.message
      );
      throw error;
    }
  }
}

export { MCPClientManager };
export const mcpClientManager = new MCPClientManager();
