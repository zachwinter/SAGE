import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { MCPClientManager } from "../client/MCPClientManager.js";
import { state } from "../state/index.js";
import type { McpServerConfig } from "../types.js";

// Mock the dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    listResources: vi.fn().mockResolvedValue({ resources: [] }),
    listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    callTool: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn()
  }))
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock("../../logger/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe("MCPClientManager", () => {
  let clientManager: MCPClientManager;
  let mockStdioConfig: McpServerConfig;
  let mockHttpConfig: McpServerConfig;

  beforeEach(() => {
    // Reset state before each test
    Object.keys(state.servers).forEach(key => delete state.servers[key]);
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];

    // Create a fresh client manager instance
    clientManager = new MCPClientManager();

    mockStdioConfig = {
      id: "test-stdio-server",
      name: "Test Stdio Server",
      type: "stdio",
      command: "node",
      args: ["test-server.js"],
      enabled: true,
      env: { TEST_ENV: "true" }
    };

    mockHttpConfig = {
      id: "test-http-server",
      name: "Test HTTP Server", 
      type: "http",
      url: "http://localhost:3000/mcp",
      enabled: true
    };

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any servers that were added
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await clientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Reset the client manager to ensure clean state for next test
    clientManager = new MCPClientManager();

    // Reset the mock to its default implementation after each test
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const MockedClient = Client as Mock;
    MockedClient.mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      listResources: vi.fn().mockResolvedValue({ resources: [] }),
      listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
      callTool: vi.fn(),
      readResource: vi.fn(),
      getPrompt: vi.fn()
    }));
  });

  describe("Server Management", () => {
    it("should add a stdio server configuration", async () => {
      await clientManager.addServer(mockStdioConfig);

      expect(state.servers[mockStdioConfig.id]).toBeDefined();
      expect(state.servers[mockStdioConfig.id].name).toBe(mockStdioConfig.name);
      expect(state.servers[mockStdioConfig.id].config).toEqual(mockStdioConfig);
      expect(state.servers[mockStdioConfig.id].status).toBe("disconnected");
    });

    it("should add an HTTP server configuration", async () => {
      await clientManager.addServer(mockHttpConfig);

      expect(state.servers[mockHttpConfig.id]).toBeDefined();
      expect(state.servers[mockHttpConfig.id].name).toBe(mockHttpConfig.name);
      expect(state.servers[mockHttpConfig.id].config).toEqual(mockHttpConfig);
      expect(state.servers[mockHttpConfig.id].status).toBe("disconnected");
    });

    it("should not duplicate server configurations", async () => {
      await clientManager.addServer(mockStdioConfig);
      await clientManager.addServer(mockStdioConfig);

      expect(Object.keys(state.servers)).toHaveLength(1);
      expect(state.servers[mockStdioConfig.id].name).toBe(mockStdioConfig.name);
    });

    it("should remove server configuration and clean up", async () => {
      await clientManager.addServer(mockStdioConfig);
      expect(state.servers[mockStdioConfig.id]).toBeDefined();

      await clientManager.removeServer(mockStdioConfig.id);
      expect(state.servers[mockStdioConfig.id]).toBeUndefined();
    });
  });

  describe("Connection Management", () => {
    it("should connect to a stdio server successfully", async () => {
      await clientManager.addServer(mockStdioConfig);

      await clientManager.connectServer(mockStdioConfig.id);

      expect(state.servers[mockStdioConfig.id].status).toBe("connected");
      expect(state.servers[mockStdioConfig.id].client).toBeDefined();
    });

    it("should connect to an HTTP server successfully", async () => {
      await clientManager.addServer(mockHttpConfig);

      await clientManager.connectServer(mockHttpConfig.id);

      expect(state.servers[mockHttpConfig.id].status).toBe("connected");
      expect(state.servers[mockHttpConfig.id].client).toBeDefined();
    });

    it("should handle connection failures gracefully", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;
      
      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        listTools: vi.fn(),
        listResources: vi.fn(),
        listPrompts: vi.fn()
      }));

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      expect(state.servers[mockStdioConfig.id].status).toBe("error");
      expect(state.servers[mockStdioConfig.id].error).toContain("Connection failed");
    });

    it("should not connect disabled servers", async () => {
      const disabledConfig = { ...mockStdioConfig, enabled: false };
      await clientManager.addServer(disabledConfig);

      await clientManager.connectServer(disabledConfig.id);

      expect(state.servers[disabledConfig.id].status).toBe("disconnected");
    });

    it("should disconnect server and update state", async () => {
      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);
      
      expect(state.servers[mockStdioConfig.id].status).toBe("connected");

      await clientManager.disconnectServer(mockStdioConfig.id);

      expect(state.servers[mockStdioConfig.id].status).toBe("disconnected");
      expect(state.servers[mockStdioConfig.id].client).toBeUndefined();
    });

    it("should connect all enabled servers", async () => {
      const config1 = { ...mockStdioConfig, id: "server1", enabled: true };
      const config2 = { ...mockHttpConfig, id: "server2", enabled: true };
      const config3 = { ...mockStdioConfig, id: "server3", enabled: false };

      await clientManager.addServer(config1);
      await clientManager.addServer(config2);
      await clientManager.addServer(config3);

      await clientManager.connectAll();

      expect(state.servers["server1"].status).toBe("connected");
      expect(state.servers["server2"].status).toBe("connected");
      expect(state.servers["server3"].status).toBe("disconnected");
    });
  });

  describe("Capability Discovery", () => {
    it("should fetch tools, resources, and prompts on connection", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      const mockTools = [
        { name: "echo", description: "Echoes the input string.", inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
        { name: "create_file", description: "Creates a file with the given content.", inputSchema: { type: "object", properties: { filePath: { type: "string" }, content: { type: "string" } }, required: ["filePath", "content"] } }
      ];
      const mockResources = [
        { uri: "test://resource", name: "Test Resource", description: "A test resource" }
      ];
      const mockPrompts = [
        { name: "test-prompt", description: "A test prompt" }
      ];

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: mockTools }),
        listResources: vi.fn().mockResolvedValue({ resources: mockResources }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: mockPrompts }),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      const server = state.servers[mockStdioConfig.id];
      expect(server.capabilities?.tools).toEqual(mockTools);
      expect(server.capabilities?.resources).toEqual(mockResources);
      expect(server.capabilities?.prompts).toEqual(mockPrompts);

      // Check that capabilities are aggregated in global state
      expect(state.availableTools).toHaveLength(2);
      const toolNames = state.availableTools.map(t => t.name);
      expect(toolNames).toContain("echo");
      expect(toolNames).toContain("create_file");
      expect(state.availableTools[0].serverId).toBe(mockStdioConfig.id);

      expect(state.availableResources).toHaveLength(1);
      expect(state.availableResources[0].uri).toBe("test://resource");
      expect(state.availableResources[0].serverId).toBe(mockStdioConfig.id);

      expect(state.availablePrompts).toHaveLength(1);
      expect(state.availablePrompts[0].name).toBe("test-prompt");
      expect(state.availablePrompts[0].serverId).toBe(mockStdioConfig.id);
    });

    it("should handle capability fetch failures gracefully", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockClear();
      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockRejectedValue(new Error("Tools not supported")),
        listResources: vi.fn().mockRejectedValue(new Error("Resources not supported")),
        listPrompts: vi.fn().mockRejectedValue(new Error("Prompts not supported")),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn()
      }));

      const failureConfig = { ...mockStdioConfig, id: "test-failure-server" };
      await clientManager.addServer(failureConfig);
      await clientManager.connectServer(failureConfig.id);

      // Should still connect successfully even if capabilities fail
      expect(state.servers[failureConfig.id].status).toBe("connected");
      expect(state.availableTools).toHaveLength(0);
      expect(state.availableResources).toHaveLength(0);
      expect(state.availablePrompts).toHaveLength(0);
    });
  });

  describe("Tool Execution", () => {
    it("should execute tools on connected servers", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;
      
      const mockCallTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Tool executed successfully" }]
      });

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: mockCallTool,
        readResource: vi.fn(),
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      const result = await clientManager.callTool(mockStdioConfig.id, "test-tool", { input: "test" });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "test-tool",
        arguments: { input: "test" }
      });
      expect(result.content[0].text).toBe("Tool executed successfully");
    });

    it("should throw error when calling tool on disconnected server", async () => {
      await clientManager.addServer(mockStdioConfig);

      await expect(
        clientManager.callTool(mockStdioConfig.id, "test-tool", {})
      ).rejects.toThrow(`Server ${mockStdioConfig.id} is not connected`);
    });

    it("should throw error when calling tool on non-existent server", async () => {
      await expect(
        clientManager.callTool("non-existent", "test-tool", {})
      ).rejects.toThrow("Server non-existent is not connected");
    });
  });

  describe("Resource Reading", () => {
    it("should read resources from connected servers", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;
      
      const mockReadResource = vi.fn().mockResolvedValue({
        contents: [{ type: "text", text: "Resource content" }]
      });

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: vi.fn(),
        readResource: mockReadResource,
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      const result = await clientManager.readResource(mockStdioConfig.id, "test://resource");

      expect(mockReadResource).toHaveBeenCalledWith({ uri: "test://resource" });
      expect(result.contents[0].text).toBe("Resource content");
    });

    it("should throw error when reading resource from disconnected server", async () => {
      await clientManager.addServer(mockStdioConfig);

      await expect(
        clientManager.readResource(mockStdioConfig.id, "test://resource")
      ).rejects.toThrow(`Server ${mockStdioConfig.id} is not connected`);
    });
  });

  describe("Prompt Execution", () => {
    it("should get prompts from connected servers", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;
      
      const mockGetPrompt = vi.fn().mockResolvedValue({
        messages: [{ role: "user", content: { type: "text", text: "Test prompt" } }]
      });

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: mockGetPrompt
      }));

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      const result = await clientManager.getPrompt(mockStdioConfig.id, "test-prompt", { arg: "value" });

      expect(mockGetPrompt).toHaveBeenCalledWith({
        name: "test-prompt",
        arguments: { arg: "value" }
      });
      expect(result.messages[0].content.text).toBe("Test prompt");
    });

    it("should throw error when getting prompt from disconnected server", async () => {
      await clientManager.addServer(mockStdioConfig);

      await expect(
        clientManager.getPrompt(mockStdioConfig.id, "test-prompt", {})
      ).rejects.toThrow(`Server ${mockStdioConfig.id} is not connected`);
    });
  });

  describe("Transport Selection", () => {
    it("should use stdio transport for servers with command", async () => {
      const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
      const MockedStdioTransport = StdioClientTransport as Mock;

      await clientManager.addServer(mockStdioConfig);
      await clientManager.connectServer(mockStdioConfig.id);

      expect(MockedStdioTransport).toHaveBeenCalledWith({
        command: mockStdioConfig.command,
        args: mockStdioConfig.args,
        env: expect.objectContaining(mockStdioConfig.env)
      });
    });

    it("should use HTTP transport for servers with URL", async () => {
      const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
      const MockedHttpTransport = StreamableHTTPClientTransport as Mock;

      await clientManager.addServer(mockHttpConfig);
      await clientManager.connectServer(mockHttpConfig.id);

      expect(MockedHttpTransport).toHaveBeenCalledWith(new URL(mockHttpConfig.url!));
    });

    it("should throw error for stdio server without command", async () => {
      const invalidConfig = { ...mockStdioConfig, command: undefined };
      await clientManager.addServer(invalidConfig);

      await clientManager.connectServer(invalidConfig.id);

      expect(state.servers[invalidConfig.id].status).toBe("error");
      expect(state.servers[invalidConfig.id].error).toContain("No command specified");
    });
  });
});