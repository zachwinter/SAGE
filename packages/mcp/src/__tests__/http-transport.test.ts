import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { MCPClientManager } from "../client/MCPClientManager.js";
import { state } from "../state/index.js";
import type { McpServerConfig } from "../types.js";

// Mock the HTTP transport
const mockHttpTransport = {
  close: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  terminateSession: vi.fn().mockResolvedValue(undefined)
};

// Mock the dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    listResources: vi.fn().mockResolvedValue({ resources: [] }),
    listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    callTool: vi
      .fn()
      .mockResolvedValue({ content: [{ type: "text", text: "HTTP tool result" }] }),
    readResource: vi
      .fn()
      .mockResolvedValue({ contents: [{ type: "text", text: "HTTP resource" }] }),
    getPrompt: vi.fn().mockResolvedValue({ messages: [] })
  }))
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => mockHttpTransport)
}));

vi.mock("../../logger/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe("HTTP Transport Support", () => {
  let clientManager: MCPClientManager;
  let httpServerConfig: McpServerConfig;
  let stdioServerConfig: McpServerConfig;

  beforeEach(() => {
    // Reset state
    Object.keys(state.servers).forEach(key => delete state.servers[key]);
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];

    clientManager = new MCPClientManager();

    httpServerConfig = {
      id: "http-server",
      name: "HTTP Test Server",
      type: "http",
      url: "http://localhost:3000/mcp",
      enabled: true
    };

    stdioServerConfig = {
      id: "stdio-server",
      name: "Stdio Test Server",
      type: "stdio",
      command: "node",
      args: ["server.js"],
      enabled: true
    };

    vi.clearAllMocks();

    // Reset mock implementations to ensure clean state
    vi.mocked(mockHttpTransport.close).mockResolvedValue(undefined);
    vi.mocked(mockHttpTransport.start).mockResolvedValue(undefined);
    vi.mocked(mockHttpTransport.send).mockResolvedValue(undefined);
    vi.mocked(mockHttpTransport.terminateSession).mockResolvedValue(undefined);
  });

  afterEach(async () => {
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
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "HTTP tool result" }]
      }),
      readResource: vi
        .fn()
        .mockResolvedValue({ contents: [{ type: "text", text: "HTTP resource" }] }),
      getPrompt: vi.fn().mockResolvedValue({ messages: [] })
    }));
  });

  describe("Transport Selection", () => {
    it("should use HTTP transport for servers with URL", async () => {
      const { StreamableHTTPClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
      );
      const MockedHttpTransport = StreamableHTTPClientTransport as Mock;

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      expect(MockedHttpTransport).toHaveBeenCalledWith(
        new URL(httpServerConfig.url!)
      );
      expect(state.servers[httpServerConfig.id].status).toBe("connected");
    });

    it("should use stdio transport for servers with command", async () => {
      const { StdioClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/stdio.js"
      );
      const MockedStdioTransport = StdioClientTransport as Mock;

      await clientManager.addServer(stdioServerConfig);
      await clientManager.connectServer(stdioServerConfig.id);

      expect(MockedStdioTransport).toHaveBeenCalledWith({
        command: stdioServerConfig.command,
        args: stdioServerConfig.args,
        env: expect.any(Object)
      });
      expect(state.servers[stdioServerConfig.id].status).toBe("connected");
    });

    it("should handle mixed transport types", async () => {
      await clientManager.addServer(httpServerConfig);
      await clientManager.addServer(stdioServerConfig);

      await Promise.all([
        clientManager.connectServer(httpServerConfig.id),
        clientManager.connectServer(stdioServerConfig.id)
      ]);

      expect(state.servers[httpServerConfig.id].status).toBe("connected");
      expect(state.servers[stdioServerConfig.id].status).toBe("connected");
    });
  });

  describe("HTTP Server Configuration", () => {
    it("should validate HTTP server URLs", async () => {
      const configs = [
        { ...httpServerConfig, url: "http://localhost:3000" },
        { ...httpServerConfig, url: "https://api.example.com/mcp" },
        { ...httpServerConfig, url: "http://192.168.1.100:8080/api/mcp" }
      ];

      for (const [index, config] of configs.entries()) {
        const serverId = `http-server-${index}`;
        const serverConfig = { ...config, id: serverId };

        await clientManager.addServer(serverConfig);
        await clientManager.connectServer(serverId);

        expect(state.servers[serverId].status).toBe("connected");
      }
    });

    it("should handle invalid URLs gracefully", async () => {
      const invalidConfig = {
        ...httpServerConfig,
        url: "not-a-valid-url"
      };

      await clientManager.addServer(invalidConfig);
      await clientManager.connectServer(invalidConfig.id);

      expect(state.servers[invalidConfig.id].status).toBe("error");
    });

    it("should require URL for HTTP servers", async () => {
      const noUrlConfig = {
        ...httpServerConfig,
        url: undefined
      };

      await clientManager.addServer(noUrlConfig);
      await clientManager.connectServer(noUrlConfig.id);

      expect(state.servers[noUrlConfig.id].status).toBe("error");
    });
  });

  describe("HTTP Tool Execution", () => {
    it("should execute tools via HTTP transport", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      const mockCallTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "HTTP tool executed" }]
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

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      const result = await clientManager.callTool(httpServerConfig.id, "http-tool", {
        data: "test"
      });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "http-tool",
        arguments: { data: "test" }
      });
      expect(result.content[0].text).toBe("HTTP tool executed");
    });

    it("should handle HTTP tool execution errors", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: vi.fn().mockRejectedValue(new Error("HTTP request failed")),
        readResource: vi.fn(),
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      await expect(
        clientManager.callTool(httpServerConfig.id, "failing-tool", {})
      ).rejects.toThrow("HTTP request failed");
    });
  });

  describe("HTTP Resource Reading", () => {
    it("should read resources via HTTP transport", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      const mockReadResource = vi.fn().mockResolvedValue({
        contents: [{ type: "text", text: "HTTP resource content" }]
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

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      const result = await clientManager.readResource(
        httpServerConfig.id,
        "http://example.com/resource"
      );

      expect(mockReadResource).toHaveBeenCalledWith({
        uri: "http://example.com/resource"
      });
      expect(result.contents[0].text).toBe("HTTP resource content");
    });

    it("should handle HTTP resource reading errors", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: vi.fn(),
        readResource: vi.fn().mockRejectedValue(new Error("Resource not found")),
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      await expect(
        clientManager.readResource(httpServerConfig.id, "http://example.com/missing")
      ).rejects.toThrow("Resource not found");
    });
  });

  describe("HTTP Prompt Execution", () => {
    it("should get prompts via HTTP transport", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      const mockGetPrompt = vi.fn().mockResolvedValue({
        messages: [
          { role: "user", content: { type: "text", text: "HTTP prompt message" } }
        ]
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

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      const result = await clientManager.getPrompt(
        httpServerConfig.id,
        "http-prompt",
        { context: "test" }
      );

      expect(mockGetPrompt).toHaveBeenCalledWith({
        name: "http-prompt",
        arguments: { context: "test" }
      });
      expect(result.messages[0].content.text).toBe("HTTP prompt message");
    });

    it("should handle HTTP prompt execution errors", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        listResources: vi.fn().mockResolvedValue({ resources: [] }),
        listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn().mockRejectedValue(new Error("Prompt not available"))
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      await expect(
        clientManager.getPrompt(httpServerConfig.id, "missing-prompt", {})
      ).rejects.toThrow("Prompt not available");
    });
  });

  describe("HTTP Connection Management", () => {
    it("should handle HTTP connection failures", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error("HTTP connection refused")),
        listTools: vi.fn(),
        listResources: vi.fn(),
        listPrompts: vi.fn()
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      expect(state.servers[httpServerConfig.id].status).toBe("error");
      expect(state.servers[httpServerConfig.id].error).toContain(
        "HTTP connection refused"
      );
    });

    it("should disconnect HTTP servers properly", async () => {
      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      expect(state.servers[httpServerConfig.id].status).toBe("connected");

      await clientManager.disconnectServer(httpServerConfig.id);

      expect(state.servers[httpServerConfig.id].status).toBe("disconnected");
      expect(mockHttpTransport.close).toHaveBeenCalled();
    });

    it("should handle HTTP server timeouts", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error("Request timeout")),
        listTools: vi.fn(),
        listResources: vi.fn(),
        listPrompts: vi.fn()
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      expect(state.servers[httpServerConfig.id].status).toBe("error");
      expect(state.servers[httpServerConfig.id].error).toContain("timeout");
    });
  });

  describe("Transport Type Configuration", () => {
    it("should handle adapter type configurations", async () => {
      const adapterConfig: McpServerConfig = {
        id: "adapter-server",
        name: "Adapter Server",
        type: "adapter",
        command: "node",
        args: ["server.js"],
        enabled: true,
        adapterConfig: {
          originalType: "stdio",
          useStdioAdapter: true,
          adapterPort: 8080
        }
      };

      await clientManager.addServer(adapterConfig);
      await clientManager.connectServer(adapterConfig.id);

      // Should fall back to stdio transport for adapter type
      expect(state.servers[adapterConfig.id].status).toBe("connected");
    });

    it("should validate transport preferences", async () => {
      const preferenceConfigs = [
        { ...httpServerConfig, transportPreference: "http" as const },
        { ...stdioServerConfig, transportPreference: "stdio" as const }
      ];

      for (const config of preferenceConfigs) {
        const serverId = `${config.type}-preference`;
        const serverConfig = { ...config, id: serverId };

        await clientManager.addServer(serverConfig);
        await clientManager.connectServer(serverId);

        expect(state.servers[serverId].status).toBe("connected");
      }
    });

    it("should handle missing required configuration", async () => {
      const configs = [
        // HTTP server without URL
        { ...httpServerConfig, url: undefined },
        // Stdio server without command
        { ...stdioServerConfig, command: undefined }
      ];

      for (const [index, config] of configs.entries()) {
        const serverId = `invalid-${index}`;
        const serverConfig = { ...config, id: serverId };

        await clientManager.addServer(serverConfig);
        await clientManager.connectServer(serverId);

        expect(state.servers[serverId].status).toBe("error");
      }
    });
  });

  describe("Capability Discovery via HTTP", () => {
    it("should discover capabilities from HTTP servers", async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const MockedClient = Client as Mock;

      const mockCapabilities = {
        tools: [
          {
            name: "echo",
            description: "Echoes the input string.",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
              required: ["message"]
            }
          },
          {
            name: "create_file",
            description: "Creates a file with the given content.",
            inputSchema: {
              type: "object",
              properties: {
                filePath: { type: "string" },
                content: { type: "string" }
              },
              required: ["filePath", "content"]
            }
          }
        ],
        resources: [
          {
            uri: "http://api.example.com/data",
            name: "API Data",
            description: "Remote data"
          }
        ],
        prompts: [{ name: "http-prompt", description: "HTTP prompt" }]
      };

      MockedClient.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: mockCapabilities.tools }),
        listResources: vi
          .fn()
          .mockResolvedValue({ resources: mockCapabilities.resources }),
        listPrompts: vi
          .fn()
          .mockResolvedValue({ prompts: mockCapabilities.prompts }),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn()
      }));

      await clientManager.addServer(httpServerConfig);
      await clientManager.connectServer(httpServerConfig.id);

      const server = state.servers[httpServerConfig.id];
      expect(server.capabilities?.tools).toEqual(mockCapabilities.tools);
      expect(server.capabilities?.resources).toEqual(mockCapabilities.resources);
      expect(server.capabilities?.prompts).toEqual(mockCapabilities.prompts);

      // Check aggregated state
      expect(state.availableTools).toHaveLength(2);
      expect(state.availableResources).toHaveLength(1);
      expect(state.availablePrompts).toHaveLength(1);

      expect(state.availableTools[0].serverId).toBe(httpServerConfig.id);
      expect(state.availableResources[0].serverId).toBe(httpServerConfig.id);
      expect(state.availablePrompts[0].serverId).toBe(httpServerConfig.id);
    });
  });
});
