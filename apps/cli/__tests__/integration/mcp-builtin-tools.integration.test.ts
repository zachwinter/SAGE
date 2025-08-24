import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import { toolRegistry } from "@/tools/registry.js";
import { mcpClientManager } from "@/mcp/client/index.js";
import { state } from "@/mcp/state/index.js";
import { Bash } from "@/tools/Bash.js";
import { Read } from "@/tools/Read.js";
import { Write } from "@/tools/Write.js";
import { Edit } from "@/tools/Edit.js";
import type { McpServerConfig, McpTool } from "@/mcp/types.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("MCP + Built-in Tools Integration Tests", () => {
  let tempDir: string;
  let testFile: string;
  let mockServerConfig: McpServerConfig;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `mcp-builtin-tools-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "integration-test.txt");

    // Mock server configuration
    mockServerConfig = {
      id: "mock-integration-server",
      name: "Mock Integration Server",
      type: "stdio",
      command: "echo",
      args: ["mock server"],
      enabled: true
    };
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset MCP state
    Object.keys(state.servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];
    state.lastUpdated = 0;

    // Clean up test files
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
  });

  afterEach(async () => {
    // Disconnect and remove any test servers
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.disconnectServer(serverId);
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Tool Registry Integration", () => {
    it("should provide access to built-in tools", () => {
      const builtinTools = toolRegistry.getBuiltinTools();

      expect(builtinTools).toHaveLength(4);

      const toolNames = builtinTools.map(tool => tool.name);
      expect(toolNames).toContain("Bash");
      expect(toolNames).toContain("Read");
      expect(toolNames).toContain("Write");
      expect(toolNames).toContain("Edit");

      // Verify each tool has required properties
      builtinTools.forEach(tool => {
        expect(tool.source).toBe("builtin");
        expect(tool.implementation).toBeDefined();
        expect(typeof tool.implementation).toBe("function");
        expect(tool.description).toBeDefined();
      });
    });

    it("should handle MCP tools alongside built-in tools", async () => {
      // Add mock server with tools
      await mcpClientManager.addServer(mockServerConfig);

      // Mock MCP tools in state
      state.availableTools = [
        {
          name: "mcp_custom_tool",
          description: "A custom MCP tool",
          inputSchema: {
            type: "object",
            properties: {
              input: { type: "string" }
            }
          },
          serverId: mockServerConfig.id,
          serverName: mockServerConfig.name
        }
      ];

      const mcpTools = toolRegistry.getMcpTools();
      const allTools = toolRegistry.getAllTools();

      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0].name).toBe("mcp_custom_tool");
      expect(mcpTools[0].source).toBe("mcp");
      expect(mcpTools[0].serverId).toBe(mockServerConfig.id);

      expect(allTools).toHaveLength(5); // 4 built-in + 1 MCP
    });

    it("should handle tool name conflicts between MCP and built-in tools", async () => {
      // Add server
      await mcpClientManager.addServer(mockServerConfig);

      // Mock MCP tool with same name as built-in tool
      state.availableTools = [
        {
          name: "Read", // Same as built-in tool
          description: "MCP version of Read tool",
          inputSchema: { type: "object" },
          serverId: mockServerConfig.id,
          serverName: mockServerConfig.name
        }
      ];

      const allTools = toolRegistry.getAllTools();
      const readTools = allTools.filter(tool => tool.name === "Read");

      expect(readTools).toHaveLength(2);
      expect(readTools.some(tool => tool.source === "builtin")).toBe(true);
      expect(readTools.some(tool => tool.source === "mcp")).toBe(true);
    });

    it("should generate LMStudio-compatible tool definitions", () => {
      const lmStudioTools = toolRegistry.getLMStudioTools();

      expect(Array.isArray(lmStudioTools)).toBe(true);
      expect(lmStudioTools.length).toBeGreaterThan(0);

      // Check that built-in tools are properly formatted
      const bashTool = lmStudioTools.find(tool => tool && tool.name === "Bash");
      expect(bashTool).toBeDefined();
      expect(bashTool.implementation).toBeDefined();
      expect(typeof bashTool.implementation).toBe("function");
    });
  });

  describe("Mixed Tool Workflows", () => {
    it("should execute built-in tools in sequence with MCP state updates", async () => {
      // Add mock server
      await mcpClientManager.addServer(mockServerConfig);

      // Verify server is in state
      expect(state.servers[mockServerConfig.id]).toBeDefined();
      expect(state.servers[mockServerConfig.id].status).toBe("disconnected");

      // Execute built-in tool chain while MCP server is present
      const content = "Content created with MCP server present";

      // Step 1: Write file
      const writeResult = await Write.implementation({
        file_path: testFile,
        content
      });
      expect(writeResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });

      // Step 2: Read file
      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);

      // Step 3: Edit file
      const editResult = await Edit.implementation({
        file_path: testFile,
        old_string: "MCP server",
        new_string: "MCP integration"
      });
      expect(editResult).toEqual({ success: true, message: expect.any(String) });

      // Verify MCP state is still intact
      expect(state.servers[mockServerConfig.id]).toBeDefined();

      // Verify final content
      const finalContent = await Read.implementation({
        file_path: testFile
      });
      expect(finalContent.success).toBe(true);
      expect(finalContent.message).toBe(
        "Content created with MCP integration present"
      );
    });

    it("should handle built-in tool execution when MCP servers fail", async () => {
      // Add server with invalid configuration
      const invalidServerConfig: McpServerConfig = {
        id: "invalid-server",
        name: "Invalid Server",
        type: "stdio",
        command: "nonexistent-command",
        args: ["--invalid"],
        enabled: true
      };

      await mcpClientManager.addServer(invalidServerConfig);

      // Attempt to connect (should fail)
      await mcpClientManager.connectServer(invalidServerConfig.id);

      // Built-in tools should still work
      const content = "Built-in tools work despite MCP failures";

      const writeResult = await Write.implementation({
        file_path: testFile,
        content
      });
      expect(writeResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });

      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);

      // Verify server is in error state but built-in tools still work
      expect(state.servers[invalidServerConfig.id].status).not.toBe("connected");
    });

    it("should coordinate file operations between built-in tools and MCP server management", async () => {
      const serverDir = join(tempDir, "mock-server");
      mkdirSync(serverDir, { recursive: true });

      // Use built-in tools to set up MCP server files
      const packageJson = {
        name: "mock-mcp-server",
        version: "1.0.0",
        main: "server.js"
      };

      // Write package.json using built-in Write tool
      const packagePath = join(serverDir, "package.json");
      await Write.implementation({
        file_path: packagePath,
        content: JSON.stringify(packageJson, null, 2)
      });

      // Write server implementation using built-in Write tool
      const serverJs = `
console.log("Mock MCP server starting...");
// Mock server implementation
`;
      const serverPath = join(serverDir, "server.js");
      await Write.implementation({
        file_path: serverPath,
        content: serverJs
      });

      // Configure MCP server to use these files
      const fileBasedServerConfig: McpServerConfig = {
        id: "file-based-server",
        name: "File-based Server",
        type: "stdio",
        command: "node",
        args: [serverPath],
        enabled: true
      };

      await mcpClientManager.addServer(fileBasedServerConfig);

      // Verify server configuration references our created files
      expect(state.servers[fileBasedServerConfig.id]).toBeDefined();
      expect(state.servers[fileBasedServerConfig.id].config.args).toContain(
        serverPath
      );

      // Use built-in Read tool to verify files were created correctly
      const readPackageResult = await Read.implementation({
        file_path: packagePath
      });
      expect(readPackageResult.success).toBe(true);
      expect(JSON.parse(readPackageResult.message)).toEqual(packageJson);

      const readServerResult = await Read.implementation({
        file_path: serverPath
      });
      expect(readServerResult.success).toBe(true);
      expect(readServerResult.message).toContain("Mock MCP server starting");
    });
  });

  describe("State Consistency", () => {
    it("should maintain MCP state consistency during built-in tool operations", async () => {
      // Set up initial MCP state
      await mcpClientManager.addServer(mockServerConfig);
      state.availableTools = [
        {
          name: "test_tool",
          description: "Test tool",
          inputSchema: { type: "object" },
          serverId: mockServerConfig.id,
          serverName: mockServerConfig.name
        }
      ];

      const initialToolCount = state.availableTools.length;
      const initialServerCount = Object.keys(state.servers).length;

      // Execute multiple built-in tool operations
      for (let i = 0; i < 5; i++) {
        const content = `Operation ${i} content`;
        const iterationFile = join(tempDir, `test-${i}.txt`);

        await Write.implementation({
          file_path: iterationFile,
          content
        });

        await Edit.implementation({
          file_path: iterationFile,
          old_string: `Operation ${i}`,
          new_string: `Completed operation ${i}`
        });

        const result = await Read.implementation({
          file_path: iterationFile
        });
        expect(result.success).toBe(true);
        expect(result.message).toBe(`Completed operation ${i} content`);
      }

      // MCP state should remain unchanged
      expect(state.availableTools).toHaveLength(initialToolCount);
      expect(Object.keys(state.servers)).toHaveLength(initialServerCount);
      expect(state.servers[mockServerConfig.id]).toBeDefined();
    });

    it("should handle concurrent built-in and MCP operations", async () => {
      await mcpClientManager.addServer(mockServerConfig);

      // Execute concurrent operations
      const [builtinResult, stateUpdate] = await Promise.all([
        // Built-in tool operation
        (async () => {
          const content = "Concurrent built-in operation";
          await Write.implementation({
            file_path: testFile,
            content
          });
          return await Read.implementation({
            file_path: testFile
          });
        })(),

        // MCP state update operation
        (async () => {
          state.availableTools.push({
            name: "concurrent_tool",
            description: "Tool added during concurrent operation",
            inputSchema: { type: "object" },
            serverId: mockServerConfig.id,
            serverName: mockServerConfig.name
          });
          return state.availableTools.length;
        })()
      ]);

      expect(builtinResult.success).toBe(true);
      expect(builtinResult.message).toBe("Concurrent built-in operation");
      expect(stateUpdate).toBe(1);
      expect(state.availableTools[0].name).toBe("concurrent_tool");
    });
  });

  describe("Error Scenarios", () => {
    it("should isolate built-in tool errors from MCP state", async () => {
      await mcpClientManager.addServer(mockServerConfig);

      // Cause built-in tool error
      const readResult = await Read.implementation({
        file_path: "/nonexistent/path/file.txt"
      });
      expect(readResult).toEqual({
        success: false,
        message: expect.stringContaining("ENOENT")
      });

      // MCP state should be unaffected
      expect(state.servers[mockServerConfig.id]).toBeDefined();
      expect(state.servers[mockServerConfig.id].status).toBe("disconnected");

      // Other built-in tools should still work
      const writeResult = await Write.implementation({
        file_path: testFile,
        content: "Recovery after error"
      });
      expect(writeResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });
    });

    it("should handle MCP server errors without affecting built-in tools", async () => {
      // Add server and simulate connection error
      await mcpClientManager.addServer(mockServerConfig);

      // Simulate error in MCP state
      state.servers[mockServerConfig.id].status = "error";
      state.servers[mockServerConfig.id].error = "Connection timeout";

      // Built-in tools should continue working
      const bashResult = await Bash.implementation({
        command: "echo 'Built-in tools work despite MCP errors'"
      });
      expect(bashResult.success).toBe(true);
      expect(bashResult.message).toContain("Built-in tools work despite MCP errors");

      const writeResult = await Write.implementation({
        file_path: testFile,
        content: "Content written despite MCP error"
      });
      expect(writeResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });

      // MCP error state should be preserved
      expect(state.servers[mockServerConfig.id].status).toBe("error");
      expect(state.servers[mockServerConfig.id].error).toBe("Connection timeout");
    });

    it("should handle tool registry access during MCP server transitions", async () => {
      // Get initial tools
      const initialTools = toolRegistry.getAllTools();
      expect(initialTools).toHaveLength(4); // Only built-in tools

      // Add MCP server
      await mcpClientManager.addServer(mockServerConfig);
      state.availableTools = [
        {
          name: "transition_tool",
          description: "Tool during server transition",
          inputSchema: { type: "object" },
          serverId: mockServerConfig.id,
          serverName: mockServerConfig.name
        }
      ];

      // Tools should include MCP tool
      const withMcpTools = toolRegistry.getAllTools();
      expect(withMcpTools).toHaveLength(5);

      // Remove MCP server
      await mcpClientManager.removeServer(mockServerConfig.id);
      state.availableTools = [];

      // Should return to built-in tools only
      const afterRemovalTools = toolRegistry.getAllTools();
      expect(afterRemovalTools).toHaveLength(4);

      // Built-in tools should still work
      const bashResult = await Bash.implementation({
        command: "echo 'Tools work after MCP removal'"
      });
      expect(bashResult.success).toBe(true);
      expect(bashResult.message).toContain("Tools work after MCP removal");
    });
  });

  describe("Tool Coordination Patterns", () => {
    it("should enable built-in tools to manage MCP server files", async () => {
      const mcpConfigDir = join(tempDir, "mcp-configs");

      // Use Bash to create MCP configuration directory
      await Bash.implementation({
        command: `mkdir -p "${mcpConfigDir}"`
      });

      // Use Write to create server configuration files
      const configs = [
        {
          name: "server1",
          config: {
            command: "python",
            args: ["-m", "server1"],
            env: { SERVER_PORT: "8001" }
          }
        },
        {
          name: "server2",
          config: {
            command: "node",
            args: ["server2.js"],
            env: { SERVER_PORT: "8002" }
          }
        }
      ];

      for (const { name, config } of configs) {
        const configPath = join(mcpConfigDir, `${name}.json`);
        await Write.implementation({
          file_path: configPath,
          content: JSON.stringify(config, null, 2)
        });

        // Read back to verify
        const readConfig = await Read.implementation({
          file_path: configPath
        });
        expect(readConfig.success).toBe(true);
        expect(JSON.parse(readConfig.message)).toEqual(config);
      }

      // Use Bash to list all config files
      const listResult = await Bash.implementation({
        command: `ls "${mcpConfigDir}" | wc -l`
      });
      expect(listResult.success).toBe(true);
      expect(listResult.message.trim()).toBe("2");

      // Use Edit to modify server configurations
      for (const { name } of configs) {
        const configPath = join(mcpConfigDir, `${name}.json`);
        await Edit.implementation({
          file_path: configPath,
          old_string: '"env": {',
          new_string: '"enabled": true,\n  "env": {'
        });
      }

      // Verify modifications
      const modifiedConfig = await Read.implementation({
        file_path: join(mcpConfigDir, "server1.json")
      });
      expect(modifiedConfig.success).toBe(true);
      expect(modifiedConfig.message).toContain('"enabled": true');
    });

    it("should support development workflow: code generation → server setup → testing", async () => {
      const projectRoot = join(tempDir, "mcp-project");

      // Step 1: Generate project structure with Bash
      await Bash.implementation({
        command: `mkdir -p "${projectRoot}/src" "${projectRoot}/tests" "${projectRoot}/config"`
      });

      // Step 2: Generate MCP server code with Write
      const serverCode = `#!/usr/bin/env python3
import json
import sys
from mcp import types

class TestMCPServer:
    def __init__(self):
        self.tools = [
            {
                "name": "test_operation",
                "description": "Performs a test operation",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "input": {"type": "string"}
                    }
                }
            }
        ]
    
    def list_tools(self):
        return self.tools
    
    def call_tool(self, name, args):
        if name == "test_operation":
            return f"Processed: {args.get('input', 'no input')}"
        raise ValueError(f"Unknown tool: {name}")

if __name__ == "__main__":
    server = TestMCPServer()
    print("MCP Test Server started")
`;

      await Write.implementation({
        file_path: join(projectRoot, "src", "server.py"),
        content: serverCode
      });

      // Step 3: Generate test configuration with Write
      const testConfig = {
        mcpServers: {
          "test-server": {
            command: "python3",
            args: [join(projectRoot, "src", "server.py")],
            env: {
              PYTHONPATH: projectRoot
            }
          }
        }
      };

      await Write.implementation({
        file_path: join(projectRoot, "config", "mcp.json"),
        content: JSON.stringify(testConfig, null, 2)
      });

      // Step 4: Generate test script with Write
      const testScript = `#!/bin/bash
echo "Testing MCP server setup..."
python3 "${projectRoot}/src/server.py" &
SERVER_PID=$!
sleep 2
echo "Server started with PID: $SERVER_PID"
kill $SERVER_PID
echo "Test completed"
`;

      await Write.implementation({
        file_path: join(projectRoot, "tests", "test-server.sh"),
        content: testScript
      });

      // Step 5: Make test script executable and verify with Bash
      await Bash.implementation({
        command: `chmod +x "${join(projectRoot, "tests", "test-server.sh")}"`
      });

      // Step 6: Verify project structure
      const structureResult = await Bash.implementation({
        command: `find "${projectRoot}" -type f | sort`
      });
      expect(structureResult.success).toBe(true);
      expect(structureResult.message).toContain("server.py");
      expect(structureResult.message).toContain("mcp.json");
      expect(structureResult.message).toContain("test-server.sh");

      // Step 7: Read and verify generated files
      const serverContent = await Read.implementation({
        file_path: join(projectRoot, "src", "server.py")
      });
      expect(serverContent.success).toBe(true);
      expect(serverContent.message).toContain("class TestMCPServer");
      expect(serverContent.message).toContain("test_operation");

      const configContent = await Read.implementation({
        file_path: join(projectRoot, "config", "mcp.json")
      });
      expect(configContent.success).toBe(true);
      const parsedConfig = JSON.parse(configContent.message);
      expect(parsedConfig.mcpServers["test-server"]).toBeDefined();
      expect(parsedConfig.mcpServers["test-server"].command).toBe("python3");
    });
  });
});
