import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getServerConfigs,
  getServerConfig,
  getEnabledServerConfigs,
  getServerConnections,
  getConnectedServers,
  getServerConnection,
  getAvailableMcpTools,
  getMcpToolByName,
  getServerStats,
  getCapabilityStats
} from "../selectors.js";
import * as stateModule from "../state.js";

// Mock the state module
vi.mock("../state.js", () => ({
  state: {
    serverConfigs: {},
    servers: {},
    availableTools: [],
    availableResources: [],
    availablePrompts: []
  }
}));

describe("mcp state selectors", () => {
  const mockState = vi.mocked(stateModule.state);

  beforeEach(() => {
    // Reset mock state before each test
    mockState.serverConfigs = {};
    mockState.servers = {};
    mockState.availableTools = [];
    mockState.availableResources = [];
    mockState.availablePrompts = [];
  });

  describe("server config selectors", () => {
    beforeEach(() => {
      mockState.serverConfigs = {
        server1: {
          id: "server1",
          name: "Test Server 1",
          command: "test-command",
          args: ["arg1"],
          enabled: true
        },
        server2: {
          id: "server2",
          name: "Test Server 2",
          command: "test-command-2",
          args: ["arg2"],
          enabled: false
        },
        server3: {
          id: "server3",
          name: "Test Server 3",
          command: "test-command-3",
          args: ["arg3"],
          enabled: true
        }
      };
    });

    it("should return all server configs", () => {
      const configs = getServerConfigs();
      expect(configs).toEqual(mockState.serverConfigs);
      expect(Object.keys(configs)).toHaveLength(3);
    });

    it("should return specific server config by id", () => {
      const config = getServerConfig("server1");
      expect(config).toEqual(mockState.serverConfigs["server1"]);
    });

    it("should return undefined for non-existent server config", () => {
      const config = getServerConfig("non-existent");
      expect(config).toBeUndefined();
    });

    it("should return only enabled server configs", () => {
      const enabledConfigs = getEnabledServerConfigs();
      expect(enabledConfigs).toHaveLength(2);
      expect(enabledConfigs.every(config => config.enabled)).toBe(true);
      expect(enabledConfigs.map(c => c.id)).toEqual(["server1", "server3"]);
    });

    it("should return empty array when no servers are enabled", () => {
      // Disable all servers
      Object.values(mockState.serverConfigs).forEach(config => {
        config.enabled = false;
      });

      const enabledConfigs = getEnabledServerConfigs();
      expect(enabledConfigs).toHaveLength(0);
    });
  });

  describe("server connection selectors", () => {
    beforeEach(() => {
      mockState.servers = {
        server1: {
          id: "server1",
          name: "Test Server 1",
          status: "connected",
          capabilities: {}
        },
        server2: {
          id: "server2",
          name: "Test Server 2",
          status: "connecting",
          capabilities: {}
        },
        server3: {
          id: "server3",
          name: "Test Server 3",
          status: "error",
          capabilities: {},
          error: "Connection failed"
        },
        server4: {
          id: "server4",
          name: "Test Server 4",
          status: "disconnected",
          capabilities: {}
        }
      };
    });

    it("should return all server connections", () => {
      const connections = getServerConnections();
      expect(connections).toEqual(mockState.servers);
      expect(Object.keys(connections)).toHaveLength(4);
    });

    it("should return only connected servers", () => {
      const connectedServers = getConnectedServers();
      expect(connectedServers).toHaveLength(1);
      expect(connectedServers[0].id).toBe("server1");
      expect(connectedServers[0].status).toBe("connected");
    });

    it("should return empty array when no servers are connected", () => {
      // Set all servers to non-connected status
      Object.values(mockState.servers).forEach(server => {
        server.status = "disconnected";
      });

      const connectedServers = getConnectedServers();
      expect(connectedServers).toHaveLength(0);
    });

    it("should return specific server connection by id", () => {
      const connection = getServerConnection("server2");
      expect(connection).toEqual(mockState.servers["server2"]);
    });

    it("should return undefined for non-existent server connection", () => {
      const connection = getServerConnection("non-existent");
      expect(connection).toBeUndefined();
    });
  });

  describe("tool selectors", () => {
    beforeEach(() => {
      mockState.availableTools = [
        {
          name: "read_file",
          description: "Read a file from disk",
          schema: { type: "object" },
          serverId: "server1"
        },
        {
          name: "write_file",
          description: "Write a file to disk",
          schema: { type: "object" },
          serverId: "server1"
        },
        {
          name: "search",
          description: "Search for content",
          schema: { type: "object" },
          serverId: "server2"
        }
      ];
    });

    it("should return all available MCP tools", () => {
      const tools = getAvailableMcpTools();
      expect(tools).toEqual(mockState.availableTools);
      expect(tools).toHaveLength(3);
    });

    it("should return specific tool by name", () => {
      const tool = getMcpToolByName("read_file");
      expect(tool).toEqual(mockState.availableTools[0]);
    });

    it("should return undefined for non-existent tool", () => {
      const tool = getMcpToolByName("non-existent");
      expect(tool).toBeUndefined();
    });

    it("should return empty array when no tools are available", () => {
      mockState.availableTools = [];
      const tools = getAvailableMcpTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe("stats selectors", () => {
    beforeEach(() => {
      mockState.servers = {
        server1: { id: "server1", status: "connected" },
        server2: { id: "server2", status: "connecting" },
        server3: { id: "server3", status: "error" },
        server4: { id: "server4", status: "disconnected" },
        server5: { id: "server5", status: "connected" },
        server6: { id: "server6", status: "error" }
      };

      mockState.availableTools = [
        { name: "tool1", serverId: "server1" },
        { name: "tool2", serverId: "server1" },
        { name: "tool3", serverId: "server2" }
      ];

      mockState.availableResources = [
        { uri: "resource1", serverId: "server1" },
        { uri: "resource2", serverId: "server2" }
      ];

      mockState.availablePrompts = [{ name: "prompt1", serverId: "server1" }];
    });

    it("should return correct server statistics", () => {
      const stats = getServerStats();
      expect(stats).toEqual({
        total: 6,
        connected: 2,
        connecting: 1,
        error: 2,
        disconnected: 1
      });
    });

    it("should return correct capability statistics", () => {
      const stats = getCapabilityStats();
      expect(stats).toEqual({
        tools: 3,
        resources: 2,
        prompts: 1
      });
    });

    it("should handle empty state for server stats", () => {
      mockState.servers = {};
      const stats = getServerStats();
      expect(stats).toEqual({
        total: 0,
        connected: 0,
        connecting: 0,
        error: 0,
        disconnected: 0
      });
    });

    it("should handle empty state for capability stats", () => {
      mockState.availableTools = [];
      mockState.availableResources = [];
      mockState.availablePrompts = [];

      const stats = getCapabilityStats();
      expect(stats).toEqual({
        tools: 0,
        resources: 0,
        prompts: 0
      });
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle null/undefined server configs gracefully", () => {
      mockState.serverConfigs = null as any;
      expect(() => getServerConfigs()).not.toThrow();
    });

    it("should handle malformed server config data", () => {
      mockState.serverConfigs = {
        malformed: { id: "malformed" } // Missing required fields
      };

      const enabledConfigs = getEnabledServerConfigs();
      expect(enabledConfigs).toHaveLength(0); // Should filter out malformed config
    });

    it("should handle malformed server connection data", () => {
      mockState.servers = {
        malformed: { id: "malformed" } // Missing status field
      };

      const connectedServers = getConnectedServers();
      expect(connectedServers).toHaveLength(0);
    });

    it("should handle malformed tool data", () => {
      mockState.availableTools = [
        { name: "valid_tool", description: "Valid tool" },
        { description: "Missing name" } as any // This will cause find() to skip it
      ];

      // Should find the valid tool despite malformed data
      const validTool = getMcpToolByName("valid_tool");
      expect(validTool).toBeDefined();
      expect(validTool?.name).toBe("valid_tool");

      // Should not find non-existent tool
      const invalidTool = getMcpToolByName("non_existent");
      expect(invalidTool).toBeUndefined();
    });

    it("should handle dynamic state changes between calls", () => {
      // Initial state with one server
      mockState.servers = {
        server1: { id: "server1", status: "connected" }
      };

      const stats1 = getServerStats();
      expect(stats1.total).toBe(1);
      expect(stats1.connected).toBe(1);

      // Add more servers
      mockState.servers = {
        server1: { id: "server1", status: "connected" },
        server2: { id: "server2", status: "error" },
        server3: { id: "server3", status: "connecting" }
      };

      const stats2 = getServerStats();
      expect(stats2.total).toBe(3);
      expect(stats2.connected).toBe(1);
      expect(stats2.error).toBe(1);
      expect(stats2.connecting).toBe(1);
    });
  });
});
