import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toolRegistry } from "@/tools/registry";
import { mcpClientManager } from "@/mcp/client/index";
import { state } from "@/mcp/state/index";
import type { McpServerConfig, McpTool } from "@/mcp/types";

// Mock the MCP client manager
vi.mock("@/mcp/client/MCPClientManager.js", () => {
  const mockCallTool = vi.fn();
  const mockReadResource = vi.fn();
  const mockGetPrompt = vi.fn();
  const mockAddServer = vi.fn();
  const mockConnectServer = vi.fn();
  const mockDisconnectServer = vi.fn();
  const mockRemoveServer = vi.fn();

  return {
    MCPClientManager: vi.fn().mockImplementation(() => ({
      callTool: mockCallTool,
      readResource: mockReadResource,
      getPrompt: mockGetPrompt,
      addServer: mockAddServer,
      connectServer: mockConnectServer,
      disconnectServer: mockDisconnectServer,
      removeServer: mockRemoveServer
    })),
    mcpClientManager: {
      callTool: mockCallTool,
      readResource: mockReadResource,
      getPrompt: mockGetPrompt,
      addServer: mockAddServer,
      connectServer: mockConnectServer,
      disconnectServer: mockDisconnectServer,
      removeServer: mockRemoveServer
    }
  };
});

describe("MCP Tool Execution Integration", () => {
  beforeEach(() => {
    // Reset state
    Object.keys(state.servers).forEach(key => delete state.servers[key]);
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Tool Registry Integration", () => {
    it("should include both built-in and MCP tools", () => {
      // Set up mock MCP tools
      state.availableTools = [
        {
          name: "mcp_test_tool",
          description: "Test MCP tool",
          inputSchema: {
            type: "object",
            properties: {
              input: { type: "string" }
            }
          },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const allTools = toolRegistry.getAllTools();
      const builtinTools = toolRegistry.getBuiltinTools();
      const mcpTools = toolRegistry.getMcpTools();

      // Should have built-in tools
      expect(builtinTools.length).toBeGreaterThan(0);
      expect(builtinTools.some(tool => tool.name === "Bash")).toBe(true);
      expect(builtinTools.some(tool => tool.name === "Read")).toBe(true);

      // Should have MCP tools
      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0].name).toBe("mcp_test_tool");
      expect(mcpTools[0].source).toBe("mcp");

      // All tools should combine both
      expect(allTools.length).toBe(builtinTools.length + mcpTools.length);
    });

    it("should handle tool name conflicts correctly", () => {
      // Create an MCP tool with same name as built-in tool
      state.availableTools = [
        {
          name: "Read", // Same as built-in
          description: "MCP version of Read",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const allTools = toolRegistry.getAllTools();
      const readTools = allTools.filter(tool => tool.name === "Read");

      expect(readTools).toHaveLength(2);
      expect(readTools.some(tool => tool.source === "builtin")).toBe(true);
      expect(readTools.some(tool => tool.source === "mcp")).toBe(true);
    });

    it("should create proper LMStudio tool definitions", () => {
      state.availableTools = [
        {
          name: "mcp_tool",
          description: "Test MCP tool",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              count: { type: "number" }
            },
            required: ["text"]
          },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const lmStudioTools = toolRegistry.getLMStudioTools();

      // Should include built-in tools
      const bashTool = lmStudioTools.find(tool => tool && tool.name === "Bash");
      expect(bashTool).toBeDefined();
      expect(typeof bashTool.implementation).toBe("function");

      // Should include MCP tools
      const mcpTool = lmStudioTools.find(tool => tool && tool.name === "mcp_tool");
      expect(mcpTool).toBeDefined();
      expect(typeof mcpTool.implementation).toBe("function");
    });
  });

  describe("MCP Tool Execution", () => {
    it("should execute MCP tools through client manager", async () => {
      const mockResult = {
        content: [{ type: "text", text: "MCP tool executed successfully" }]
      };

      vi.mocked(mcpClientManager.callTool).mockResolvedValue(mockResult);

      state.availableTools = [
        {
          name: "test_tool",
          description: "Test tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const mcpTools = toolRegistry.getMcpTools();
      const testTool = mcpTools[0];

      const result = await testTool.implementation({ input: "test data" });

      expect(mcpClientManager.callTool).toHaveBeenCalledWith(
        "test-server",
        "test_tool",
        { input: "test data" }
      );
      expect(result).toEqual(mockResult);
    });

    it("should handle tool execution errors", async () => {
      const errorMessage = "Tool execution failed";
      vi.mocked(mcpClientManager.callTool).mockRejectedValue(
        new Error(errorMessage)
      );

      state.availableTools = [
        {
          name: "failing_tool",
          description: "Failing tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const mcpTools = toolRegistry.getMcpTools();
      const failingTool = mcpTools[0];

      await expect(failingTool.implementation({ input: "test" })).rejects.toThrow(
        errorMessage
      );
    });

    it("should pass correct arguments to MCP tools", async () => {
      vi.mocked(mcpClientManager.callTool).mockResolvedValue({ success: true });

      state.availableTools = [
        {
          name: "argument_tool",
          description: "Tool that takes arguments",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string" },
              count: { type: "number" },
              enabled: { type: "boolean" }
            }
          },
          serverId: "arg-server",
          serverName: "Argument Server"
        }
      ] as McpTool[];

      const mcpTools = toolRegistry.getMcpTools();
      const argTool = mcpTools[0];

      const args = {
        message: "Hello, world!",
        count: 42,
        enabled: true
      };

      await argTool.implementation(args);

      expect(mcpClientManager.callTool).toHaveBeenCalledWith(
        "arg-server",
        "argument_tool",
        args
      );
    });
  });

  describe("Built-in Tool Functionality", () => {
    it("should execute built-in tools without MCP interference", async () => {
      // Add some MCP tools to state
      state.availableTools = [
        {
          name: "mcp_tool",
          description: "MCP tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const builtinTools = toolRegistry.getBuiltinTools();
      const readTool = builtinTools.find(tool => tool.name === "Read");

      expect(readTool).toBeDefined();
      expect(readTool!.source).toBe("builtin");
      expect(typeof readTool!.implementation).toBe("function");

      // Should not call MCP client manager for built-in tools
      // (This is tested by the actual tool implementation)
    });

    it("should maintain separation between built-in and MCP tools", () => {
      state.availableTools = [
        {
          name: "mcp_bash",
          description: "MCP Bash tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const allTools = toolRegistry.getAllTools();
      const bashTools = allTools.filter(tool => tool.name === "Bash");
      const mcpBashTools = allTools.filter(tool => tool.name === "mcp_bash");

      // Should have built-in Bash
      expect(bashTools).toHaveLength(1);
      expect(bashTools[0].source).toBe("builtin");

      // Should have MCP bash tool
      expect(mcpBashTools).toHaveLength(1);
      expect(mcpBashTools[0].source).toBe("mcp");
    });
  });

  describe("Tool Discovery Workflow", () => {
    it("should update available tools when server capabilities change", () => {
      // Start with no tools
      expect(state.availableTools).toHaveLength(0);

      // Simulate server connection with tools
      const mockTools: McpTool[] = [
        {
          name: "discovered_tool_1",
          description: "First discovered tool",
          inputSchema: { type: "object" },
          serverId: "discovery-server",
          serverName: "Discovery Server"
        },
        {
          name: "discovered_tool_2",
          description: "Second discovered tool",
          inputSchema: { type: "object" },
          serverId: "discovery-server",
          serverName: "Discovery Server"
        }
      ];

      state.availableTools = mockTools;

      const mcpTools = toolRegistry.getMcpTools();
      expect(mcpTools).toHaveLength(2);
      expect(mcpTools[0].name).toBe("discovered_tool_1");
      expect(mcpTools[1].name).toBe("discovered_tool_2");
    });

    it("should handle multiple servers with tools", () => {
      const mockTools: McpTool[] = [
        {
          name: "server1_tool",
          description: "Tool from server 1",
          inputSchema: { type: "object" },
          serverId: "server-1",
          serverName: "Server 1"
        },
        {
          name: "server2_tool",
          description: "Tool from server 2",
          inputSchema: { type: "object" },
          serverId: "server-2",
          serverName: "Server 2"
        },
        {
          name: "server1_tool2",
          description: "Second tool from server 1",
          inputSchema: { type: "object" },
          serverId: "server-1",
          serverName: "Server 1"
        }
      ];

      state.availableTools = mockTools;

      const mcpTools = toolRegistry.getMcpTools();
      expect(mcpTools).toHaveLength(3);

      const server1Tools = mcpTools.filter(tool => tool.serverId === "server-1");
      const server2Tools = mcpTools.filter(tool => tool.serverId === "server-2");

      expect(server1Tools).toHaveLength(2);
      expect(server2Tools).toHaveLength(1);
    });

    it("should handle empty tool lists", () => {
      state.availableTools = [];

      const mcpTools = toolRegistry.getMcpTools();
      const allTools = toolRegistry.getAllTools();
      const builtinTools = toolRegistry.getBuiltinTools();

      expect(mcpTools).toHaveLength(0);
      expect(allTools.length).toBe(builtinTools.length);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed tool definitions", () => {
      // Add malformed tool (missing required properties)
      state.availableTools = [
        {
          name: "valid_tool",
          description: "Valid tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        },
        {
          // Missing name
          description: "Invalid tool",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        } as any
      ];

      const mcpTools = toolRegistry.getMcpTools();

      // Should still include valid tools
      expect(mcpTools.some(tool => tool.name === "valid_tool")).toBe(true);

      // Should handle malformed tools gracefully
      expect(() => toolRegistry.getAllTools()).not.toThrow();
    });

    it("should handle server disconnection gracefully", async () => {
      vi.mocked(mcpClientManager.callTool).mockRejectedValue(
        new Error("Server test-server is not connected")
      );

      state.availableTools = [
        {
          name: "disconnected_tool",
          description: "Tool from disconnected server",
          inputSchema: { type: "object" },
          serverId: "test-server",
          serverName: "Test Server"
        }
      ] as McpTool[];

      const mcpTools = toolRegistry.getMcpTools();
      const tool = mcpTools[0];

      await expect(tool.implementation({ test: "data" })).rejects.toThrow(
        "Server test-server is not connected"
      );
    });
  });
});
