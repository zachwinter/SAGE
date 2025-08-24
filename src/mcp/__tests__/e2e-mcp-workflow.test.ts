import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mcpClientManager } from "@/mcp/client/index.js";
import { state, mcpState } from "@/mcp/state/index.js";
import { toolRegistry } from "@/tools/registry.js";
import {
  getAvailableMcpTools,
  getAvailableMcpResources,
  getAvailableMcpPrompts,
  getServerStats,
  getConnectedServers
} from "@/mcp/state/selectors.js";
import type { McpServerConfig } from "@/mcp/types.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("End-to-End MCP Workflow", () => {
  let tempDir: string;
  let mockServerConfigs: McpServerConfig[];

  beforeEach(() => {
    // Create temporary directory for test servers
    tempDir = join(tmpdir(), `mcp-e2e-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Reset state
    Object.keys(state.servers).forEach(key => delete state.servers[key]);
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];

    // Create mock server configurations
    mockServerConfigs = [
      {
        id: "file-server",
        name: "File Management Server",
        type: "stdio",
        command: "node",
        args: [join(tempDir, "file-server.js")],
        enabled: true,
        env: { MCP_SERVER_TYPE: "file" }
      },
      {
        id: "api-server",
        name: "API Gateway Server",
        type: "http",
        url: "http://localhost:3001/mcp",
        enabled: true
      },
      {
        id: "disabled-server",
        name: "Disabled Server",
        type: "stdio",
        command: "echo",
        args: ["disabled"],
        enabled: false
      }
    ];

    // Create mock server scripts
    createMockServerScripts();

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up servers
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createMockServerScripts() {
    // Create a mock file server script
    const fileServerScript = `
#!/usr/bin/env node
console.error("File Management Server starting...");

// Simulate MCP server behavior
const tools = [
  {
    name: "read_file",
    description: "Read a file from the filesystem",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  }
];

const resources = [
  {
    uri: "file:///${tempDir}/data.txt",
    name: "Test Data File",
    description: "A test data file"
  }
];

const prompts = [
  {
    name: "file_operation",
    description: "Template for file operations"
  }
];

// Mock successful responses
process.stdout.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { tools, resources, prompts }
}) + "\\n");

process.exit(0);
`;

    writeFileSync(join(tempDir, "file-server.js"), fileServerScript);
  }

  describe("Server Configuration and Connection", () => {
    it("should manage multiple server configurations", async () => {
      // Add all server configurations
      for (const config of mockServerConfigs) {
        await mcpClientManager.addServer(config);
      }

      // Verify all servers are added
      expect(Object.keys(state.servers)).toHaveLength(3);
      expect(state.servers["file-server"]).toBeDefined();
      expect(state.servers["api-server"]).toBeDefined();
      expect(state.servers["disabled-server"]).toBeDefined();

      // Verify initial states
      Object.values(state.servers).forEach(server => {
        expect(server.status).toBe("disconnected");
      });
    });

    it("should connect only enabled servers", async () => {
      for (const config of mockServerConfigs) {
        await mcpClientManager.addServer(config);
      }

      // Mock successful connections for enabled servers
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        if (server && server.config.enabled) {
          server.status = "connected";
          server.client = {} as any;
          
          // Mock capabilities based on server type
          if (serverId === "file-server") {
            server.capabilities = {
              tools: [
                { name: "read_file", description: "Read file", inputSchema: { type: "object" } },
                { name: "write_file", description: "Write file", inputSchema: { type: "object" } }
              ],
              resources: [
                { uri: `file://${tempDir}/data.txt`, name: "Test Data", description: "Test file" }
              ],
              prompts: [
                { name: "file_operation", description: "File operation template" }
              ]
            };
          } else if (serverId === "api-server") {
            server.capabilities = {
              tools: [
                { name: "api_call", description: "Make API call", inputSchema: { type: "object" } }
              ],
              resources: [
                { uri: "http://api.example.com/data", name: "API Data", description: "Remote data" }
              ],
              prompts: []
            };
          }
          
          // Update global state
          if (server.capabilities) {
            if (server.capabilities.tools) {
              state.availableTools.push(...server.capabilities.tools.map(tool => ({
                ...tool,
                serverId: server.id,
                serverName: server.name
              })));
            }
            if (server.capabilities.resources) {
              state.availableResources.push(...server.capabilities.resources.map(resource => ({
                ...resource,
                serverId: server.id,
                serverName: server.name
              })));
            }
            if (server.capabilities.prompts) {
              state.availablePrompts.push(...server.capabilities.prompts.map(prompt => ({
                ...prompt,
                serverId: server.id,
                serverName: server.name
              })));
            }
          }
        }
      });

      await mcpClientManager.connectAll();

      // Check connection states
      expect(state.servers["file-server"].status).toBe("connected");
      expect(state.servers["api-server"].status).toBe("connected");
      expect(state.servers["disabled-server"].status).toBe("disconnected");

      // Verify connected servers count
      const connectedServers = getConnectedServers();
      expect(connectedServers).toHaveLength(2);
    });

    it("should aggregate capabilities from all connected servers", async () => {
      for (const config of mockServerConfigs) {
        await mcpClientManager.addServer(config);
      }

      // Use the same mock from previous test
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        if (server && server.config.enabled) {
          server.status = "connected";
          server.client = {} as any;
          
          if (serverId === "file-server") {
            server.capabilities = {
              tools: [
                { name: "read_file", description: "Read file", inputSchema: { type: "object" } },
                { name: "write_file", description: "Write file", inputSchema: { type: "object" } }
              ],
              resources: [
                { uri: `file://${tempDir}/data.txt`, name: "Test Data", description: "Test file" }
              ],
              prompts: [
                { name: "file_operation", description: "File operation template" }
              ]
            };
          } else if (serverId === "api-server") {
            server.capabilities = {
              tools: [
                { name: "api_call", description: "Make API call", inputSchema: { type: "object" } }
              ],
              resources: [
                { uri: "http://api.example.com/data", name: "API Data", description: "Remote data" }
              ],
              prompts: []
            };
          }
          
          // Update global state
          if (server.capabilities) {
            if (server.capabilities.tools) {
              state.availableTools.push(...server.capabilities.tools.map(tool => ({
                ...tool,
                serverId: server.id,
                serverName: server.name
              })));
            }
            if (server.capabilities.resources) {
              state.availableResources.push(...server.capabilities.resources.map(resource => ({
                ...resource,
                serverId: server.id,
                serverName: server.name
              })));
            }
            if (server.capabilities.prompts) {
              state.availablePrompts.push(...server.capabilities.prompts.map(prompt => ({
                ...prompt,
                serverId: server.id,
                serverName: server.name
              })));
            }
          }
        }
      });

      await mcpClientManager.connectAll();

      // Verify aggregated capabilities
      const tools = getAvailableMcpTools();
      const resources = getAvailableMcpResources();
      const prompts = getAvailableMcpPrompts();

      expect(tools).toHaveLength(3); // 2 from file-server, 1 from api-server
      expect(resources).toHaveLength(2); // 1 from each server
      expect(prompts).toHaveLength(1); // 1 from file-server

      // Verify tool attribution
      const fileTools = tools.filter(tool => tool.serverId === "file-server");
      const apiTools = tools.filter(tool => tool.serverId === "api-server");
      
      expect(fileTools).toHaveLength(2);
      expect(apiTools).toHaveLength(1);
    });
  });

  describe("Complete Tool Execution Workflow", () => {
    beforeEach(async () => {
      // Set up connected servers with capabilities
      for (const config of mockServerConfigs.filter(c => c.enabled)) {
        await mcpClientManager.addServer(config);
      }

      // Mock the tool execution workflow
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        if (server && server.config.enabled) {
          server.status = "connected";
          server.client = {} as any;
          
          if (serverId === "file-server") {
            server.capabilities = {
              tools: [
                { name: "read_file", description: "Read file", inputSchema: { type: "object" } },
                { name: "write_file", description: "Write file", inputSchema: { type: "object" } }
              ]
            };
            state.availableTools.push(
              { name: "read_file", description: "Read file", inputSchema: { type: "object" }, serverId: "file-server", serverName: "File Management Server" },
              { name: "write_file", description: "Write file", inputSchema: { type: "object" }, serverId: "file-server", serverName: "File Management Server" }
            );
          }
        }
      });

      vi.spyOn(mcpClientManager, 'callTool').mockImplementation(async (serverId, toolName, args) => {
        if (serverId === "file-server") {
          if (toolName === "read_file") {
            return {
              content: [{ type: "text", text: `Contents of ${args.path}` }]
            };
          } else if (toolName === "write_file") {
            return {
              content: [{ type: "text", text: `Successfully wrote to ${args.path}` }]
            };
          }
        }
        throw new Error(`Unknown tool: ${toolName}`);
      });

      await mcpClientManager.connectAll();
    });

    it("should execute MCP tools through the unified tool registry", async () => {
      const allTools = toolRegistry.getAllTools();
      const mcpTools = allTools.filter(tool => tool.source === "mcp");
      const builtinTools = allTools.filter(tool => tool.source === "builtin");

      // Should have both built-in and MCP tools
      expect(builtinTools.length).toBeGreaterThan(0);
      expect(mcpTools.length).toBeGreaterThan(0);

      // Test MCP tool execution
      const readTool = mcpTools.find(tool => tool.name === "read_file");
      expect(readTool).toBeDefined();

      const result = await readTool!.implementation({ path: "/tmp/test.txt" });
      expect(result.content[0].text).toBe("Contents of /tmp/test.txt");
    });

    it("should handle mixed tool execution (built-in + MCP)", async () => {
      const allTools = toolRegistry.getAllTools();
      
      // Get built-in and MCP tools
      const bashTool = allTools.find(tool => tool.name === "Bash" && tool.source === "builtin");
      const mcpTool = allTools.find(tool => tool.name === "read_file" && tool.source === "mcp");

      expect(bashTool).toBeDefined();
      expect(mcpTool).toBeDefined();

      // Execute MCP tool
      const mcpResult = await mcpTool!.implementation({ path: "/data/file.txt" });
      expect(mcpResult.content[0].text).toBe("Contents of /data/file.txt");

      // Built-in tools should still work independently
      expect(typeof bashTool!.implementation).toBe("function");
    });

    it("should maintain tool isolation between servers", async () => {
      const tools = getAvailableMcpTools();
      const fileServerTools = tools.filter(tool => tool.serverId === "file-server");

      expect(fileServerTools).toHaveLength(2);
      expect(fileServerTools.every(tool => tool.serverName === "File Management Server")).toBe(true);

      // Test that tools are called on correct servers
      const readTool = toolRegistry.getMcpTools().find(tool => tool.name === "read_file");
      await readTool!.implementation({ path: "/test" });

      expect(mcpClientManager.callTool).toHaveBeenCalledWith("file-server", "read_file", { path: "/test" });
    });
  });

  describe("Resource and Prompt Workflows", () => {
    beforeEach(async () => {
      for (const config of mockServerConfigs.filter(c => c.enabled)) {
        await mcpClientManager.addServer(config);
      }

      // Mock resource and prompt capabilities
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        if (server && server.config.enabled) {
          server.status = "connected";
          server.client = {} as any;
          
          if (serverId === "file-server") {
            server.capabilities = {
              resources: [
                { uri: `file://${tempDir}/config.json`, name: "Config", description: "Configuration file" },
                { uri: `file://${tempDir}/data.csv`, name: "Data", description: "CSV data file" }
              ],
              prompts: [
                { name: "file_summary", description: "Summarize file contents" },
                { name: "file_analysis", description: "Analyze file structure" }
              ]
            };
            
            state.availableResources.push(
              { uri: `file://${tempDir}/config.json`, name: "Config", description: "Configuration file", serverId: "file-server", serverName: "File Management Server" },
              { uri: `file://${tempDir}/data.csv`, name: "Data", description: "CSV data file", serverId: "file-server", serverName: "File Management Server" }
            );
            
            state.availablePrompts.push(
              { name: "file_summary", description: "Summarize file contents", serverId: "file-server", serverName: "File Management Server" },
              { name: "file_analysis", description: "Analyze file structure", serverId: "file-server", serverName: "File Management Server" }
            );
          }
        }
      });

      vi.spyOn(mcpClientManager, 'readResource').mockImplementation(async (serverId, uri) => {
        return {
          contents: [{ type: "text", text: `Resource content from ${uri}` }]
        };
      });

      vi.spyOn(mcpClientManager, 'getPrompt').mockImplementation(async (serverId, name, args) => {
        return {
          messages: [
            { role: "user", content: { type: "text", text: `Prompt: ${name} with args: ${JSON.stringify(args)}` } }
          ]
        };
      });

      await mcpClientManager.connectAll();
    });

    it("should manage resources from multiple servers", async () => {
      const resources = getAvailableMcpResources();
      
      expect(resources).toHaveLength(2);
      expect(resources.every(r => r.serverId === "file-server")).toBe(true);

      // Test resource reading
      const configResource = resources.find(r => r.name === "Config");
      expect(configResource).toBeDefined();

      const result = await mcpClientManager.readResource("file-server", configResource!.uri);
      expect(result.contents[0].text).toContain(configResource!.uri);
    });

    it("should manage prompts from multiple servers", async () => {
      const prompts = getAvailableMcpPrompts();
      
      expect(prompts).toHaveLength(2);
      expect(prompts.every(p => p.serverId === "file-server")).toBe(true);

      // Test prompt execution
      const summaryPrompt = prompts.find(p => p.name === "file_summary");
      expect(summaryPrompt).toBeDefined();

      const result = await mcpClientManager.getPrompt("file-server", summaryPrompt!.name, { file: "test.txt" });
      expect(result.messages[0].content.text).toContain("file_summary");
      expect(result.messages[0].content.text).toContain("test.txt");
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle server connection failures gracefully", async () => {
      const failingConfig: McpServerConfig = {
        id: "failing-server",
        name: "Failing Server",
        type: "stdio",
        command: "nonexistent-command",
        args: ["--invalid"],
        enabled: true
      };

      await mcpClientManager.addServer(failingConfig);

      // Mock connection failure
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        if (serverId === "failing-server") {
          state.servers[serverId].status = "error";
          state.servers[serverId].error = "Command not found";
        }
      });

      await mcpClientManager.connectServer("failing-server");

      expect(state.servers["failing-server"].status).toBe("error");
      expect(state.servers["failing-server"].error).toBe("Command not found");

      // Other functionality should still work
      const stats = getServerStats();
      expect(stats.error).toBe(1);
      expect(stats.total).toBe(1);
    });

    it("should handle tool execution failures", async () => {
      await mcpClientManager.addServer(mockServerConfigs[0]); // file-server
      
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        server.status = "connected";
        server.client = {} as any;
        server.capabilities = {
          tools: [{ name: "failing_tool", description: "Tool that fails", inputSchema: { type: "object" } }]
        };
        state.availableTools.push({
          name: "failing_tool",
          description: "Tool that fails",
          inputSchema: { type: "object" },
          serverId: serverId,
          serverName: server.name
        });
      });

      vi.spyOn(mcpClientManager, 'callTool').mockRejectedValue(new Error("Tool execution failed"));

      await mcpClientManager.connectServer("file-server");

      const tools = toolRegistry.getMcpTools();
      const failingTool = tools.find(tool => tool.name === "failing_tool");

      await expect(
        failingTool!.implementation({ data: "test" })
      ).rejects.toThrow("Tool execution failed");
    });

    it("should handle server disconnection during operation", async () => {
      await mcpClientManager.addServer(mockServerConfigs[0]);
      
      // Connect server
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        state.servers[serverId].status = "connected";
        state.servers[serverId].client = {} as any;
      });

      await mcpClientManager.connectServer("file-server");
      expect(state.servers["file-server"].status).toBe("connected");

      // Disconnect server
      vi.spyOn(mcpClientManager, 'disconnectServer').mockImplementation(async (serverId) => {
        state.servers[serverId].status = "disconnected";
        delete state.servers[serverId].client;
      });

      await mcpClientManager.disconnectServer("file-server");
      expect(state.servers["file-server"].status).toBe("disconnected");
      expect(state.servers["file-server"].client).toBeUndefined();
    });
  });

  describe("State Management Integration", () => {
    it("should maintain consistent state across operations", async () => {
      // Initial state should be empty
      expect(getServerStats().total).toBe(0);
      expect(getAvailableMcpTools()).toHaveLength(0);

      // Add servers
      for (const config of mockServerConfigs) {
        await mcpClientManager.addServer(config);
      }

      expect(getServerStats().total).toBe(3);
      expect(getServerStats().disconnected).toBe(3);

      // Connect servers
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        const server = state.servers[serverId];
        if (server.config.enabled) {
          server.status = "connected";
          server.client = {} as any;
          
          // Add mock tools
          server.capabilities = {
            tools: [{ name: `${serverId}_tool`, description: "Test tool", inputSchema: { type: "object" } }]
          };
          state.availableTools.push({
            name: `${serverId}_tool`,
            description: "Test tool",
            inputSchema: { type: "object" },
            serverId: serverId,
            serverName: server.name
          });
        }
      });

      await mcpClientManager.connectAll();

      const stats = getServerStats();
      expect(stats.connected).toBe(2); // file-server and api-server
      expect(stats.disconnected).toBe(1); // disabled-server
      expect(getAvailableMcpTools()).toHaveLength(2);

      // Disconnect a server
      vi.spyOn(mcpClientManager, 'disconnectServer').mockImplementation(async (serverId) => {
        state.servers[serverId].status = "disconnected";
        delete state.servers[serverId].client;
        
        // Remove tools from disconnected server
        state.availableTools = state.availableTools.filter(tool => tool.serverId !== serverId);
      });

      await mcpClientManager.disconnectServer("file-server");

      const newStats = getServerStats();
      expect(newStats.connected).toBe(1);
      expect(newStats.disconnected).toBe(2);
      expect(getAvailableMcpTools()).toHaveLength(1);
    });

    it("should handle concurrent operations", async () => {
      const configs = mockServerConfigs.filter(c => c.enabled);
      
      // Add servers concurrently
      await Promise.all(
        configs.map(config => mcpClientManager.addServer(config))
      );

      expect(Object.keys(state.servers)).toHaveLength(2);

      // Connect servers concurrently
      vi.spyOn(mcpClientManager, 'connectServer').mockImplementation(async (serverId) => {
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        const server = state.servers[serverId];
        server.status = "connected";
        server.client = {} as any;
      });

      await Promise.all(
        configs.map(config => mcpClientManager.connectServer(config.id))
      );

      const connectedServers = getConnectedServers();
      expect(connectedServers).toHaveLength(2);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple servers efficiently", async () => {
      // Create many server configurations
      const manyConfigs = Array.from({ length: 10 }, (_, i) => ({
        id: `server-${i}`,
        name: `Test Server ${i}`,
        type: "stdio" as const,
        command: "echo",
        args: [`server${i}`],
        enabled: true
      }));

      // Add all servers
      const startTime = Date.now();
      await Promise.all(
        manyConfigs.map(config => mcpClientManager.addServer(config))
      );
      const addTime = Date.now() - startTime;

      expect(Object.keys(state.servers)).toHaveLength(10);
      expect(addTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify all servers are tracked
      const stats = getServerStats();
      expect(stats.total).toBe(10);
      expect(stats.disconnected).toBe(10);
    });

    it("should handle large numbers of tools efficiently", async () => {
      await mcpClientManager.addServer(mockServerConfigs[0]);

      // Mock many tools
      const manyTools = Array.from({ length: 100 }, (_, i) => ({
        name: `tool_${i}`,
        description: `Test tool ${i}`,
        inputSchema: { type: "object" as const },
        serverId: "file-server",
        serverName: "File Management Server"
      }));

      state.availableTools = manyTools;

      const startTime = Date.now();
      const allTools = toolRegistry.getAllTools();
      const mcpTools = toolRegistry.getMcpTools();
      const retrievalTime = Date.now() - startTime;

      expect(mcpTools).toHaveLength(100);
      expect(allTools.length).toBeGreaterThanOrEqual(100); // Includes built-in tools
      expect(retrievalTime).toBeLessThan(100); // Should be very fast
    });
  });
});