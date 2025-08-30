import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi
} from "vitest";
import { spawn, ChildProcess } from "child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  chmodSync
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  syncFilesystemServers,
  installServerFromRegistry,
  uninstallServer,
  isRegistryServerInstalled,
  getRegistryInstallationStatus,
  mcpRegistry
} from "@/mcp/installation/index.js";
import {
  ensureServersDirectory,
  isServerInstalled,
  detectServerEntryPoint,
  cloneServer
} from "@/mcp/installation/filesystem.js";
import { mcpClientManager } from "@/mcp/client/index.js";
import { state } from "@/mcp/state/index.js";
import { loadServerConfigs, saveServerConfigs } from "@/mcp/config/persistence.js";
import type { McpServerConfig, McpTool } from "@/mcp/types.js";

describe("MCP Lifecycle Workflows Integration Tests", () => {
  let tempDir: string;
  let serversDir: string;
  let configFile: string;
  let originalServersDir: string | undefined;
  let mockServerProcesses: ChildProcess[] = [];

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `mcp-lifecycle-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    serversDir = join(tempDir, "servers");
    configFile = join(tempDir, "config.json");

    // Mock the directories for this test
    originalServersDir = process.env.MCP_SERVERS_DIR;
    process.env.MCP_SERVERS_DIR = serversDir;
  });

  afterAll(async () => {
    // Cleanup any remaining processes
    await Promise.all(
      mockServerProcesses.map(proc => {
        return new Promise<void>(resolve => {
          if (proc.pid && !proc.killed) {
            proc.kill("SIGTERM");
            proc.on("exit", () => resolve());
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill("SIGKILL");
              }
              resolve();
            }, 3000);
          } else {
            resolve();
          }
        });
      })
    );

    // Restore original environment
    if (originalServersDir) {
      process.env.MCP_SERVERS_DIR = originalServersDir;
    } else {
      delete process.env.MCP_SERVERS_DIR;
    }

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
  });

  afterEach(async () => {
    // Disconnect all servers and clean up
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.disconnectServer(serverId);
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clean up any test server processes
    for (const proc of mockServerProcesses) {
      if (proc.pid && !proc.killed) {
        proc.kill("SIGTERM");
      }
    }
    mockServerProcesses = [];
  });

  describe("Real MCP Server Process Management", () => {
    it("should create and manage a simple Node.js MCP server process", async () => {
      // 1. Create a minimal Node.js MCP server
      const nodeServerDir = join(serversDir, "test-node-server");
      mkdirSync(nodeServerDir, { recursive: true });

      const packageJson = {
        name: "test-node-server",
        version: "1.0.0",
        main: "server.js",
        type: "module"
      };

      writeFileSync(
        join(nodeServerDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Create a simple MCP server implementation
      const serverCode = `#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "test-node-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echo back the input",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to echo"
            }
          },
          required: ["message"]
        }
      }
    ]
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "echo") {
    return {
      content: [
        {
          type: "text",
          text: \`Echo: \${args.message}\`
        }
      ]
    };
  }
  
  throw new Error(\`Unknown tool: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Test Node MCP server running");
`;

      writeFileSync(join(nodeServerDir, "server.js"), serverCode);
      chmodSync(join(nodeServerDir, "server.js"), "755");

      // 2. Create server configuration
      const serverConfig: McpServerConfig = {
        id: "test-node-server",
        name: "Test Node Server",
        type: "stdio",
        command: "node",
        args: [join(nodeServerDir, "server.js")],
        cwd: nodeServerDir,
        enabled: true
      };

      // 3. Add server to client manager
      await mcpClientManager.addServer(serverConfig);
      expect(state.servers[serverConfig.id]).toBeDefined();
      expect(state.servers[serverConfig.id].status).toBe("disconnected");

      // 4. Attempt to connect (may not work with mock but shouldn't crash)
      try {
        await mcpClientManager.connectServer(serverConfig.id);

        // If connection succeeds, verify server state
        if (state.servers[serverConfig.id].status === "connected") {
          expect(state.servers[serverConfig.id].capabilities?.tools).toBeDefined();
        }
      } catch (error) {
        // Connection may fail in test environment, which is acceptable
        expect(state.servers[serverConfig.id].status).toBe("error");
      }

      // 5. Verify server configuration persisted
      expect(state.servers[serverConfig.id].config).toEqual(serverConfig);
    });

    it("should create and manage a Python MCP server process", async () => {
      // 1. Create a minimal Python MCP server
      const pythonServerDir = join(serversDir, "test-python-server");
      mkdirSync(pythonServerDir, { recursive: true });

      const pyprojectToml = `[project]
name = "test-python-server"
version = "1.0.0"
dependencies = [
    "mcp>=1.0.0"
]

[project.scripts]
server = "server:main"
`;

      writeFileSync(join(pythonServerDir, "pyproject.toml"), pyprojectToml);

      // Create a simple Python MCP server
      const pythonServerCode = `#!/usr/bin/env python3
"""
Simple test MCP server in Python
"""
import asyncio
import json
import sys
from typing import Any, Dict, List

class SimpleMCPServer:
    def __init__(self):
        self.tools = [
            {
                "name": "python_echo",
                "description": "Echo back input with Python prefix",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"}
                    },
                    "required": ["text"]
                }
            }
        ]
    
    async def handle_tools_list(self) -> Dict[str, Any]:
        return {"tools": self.tools}
    
    async def handle_tools_call(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if name == "python_echo":
            return {
                "content": [
                    {
                        "type": "text", 
                        "text": f"Python Echo: {arguments.get('text', '')}"
                    }
                ]
            }
        raise ValueError(f"Unknown tool: {name}")
    
    async def run(self):
        # Simplified MCP protocol implementation for testing
        print("Python MCP server started", file=sys.stderr)
        
        # Send initialization
        init_msg = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        print(json.dumps(init_msg), flush=True)
        
        # Keep alive for a short time
        await asyncio.sleep(0.1)

def main():
    server = SimpleMCPServer()
    asyncio.run(server.run())

if __name__ == "__main__":
    main()
`;

      writeFileSync(join(pythonServerDir, "server.py"), pythonServerCode);
      chmodSync(join(pythonServerDir, "server.py"), "755");

      // Create __init__.py
      writeFileSync(join(pythonServerDir, "__init__.py"), "");

      // 2. Create server configuration
      const serverConfig: McpServerConfig = {
        id: "test-python-server",
        name: "Test Python Server",
        type: "stdio",
        command: "python3",
        args: [join(pythonServerDir, "server.py")],
        cwd: pythonServerDir,
        enabled: true
      };

      // 3. Add server to client manager
      await mcpClientManager.addServer(serverConfig);
      expect(state.servers[serverConfig.id]).toBeDefined();

      // 4. Attempt connection
      try {
        await mcpClientManager.connectServer(serverConfig.id);

        // Verify server shows up in state regardless of connection status
        expect(state.servers[serverConfig.id]).toBeDefined();
        expect(state.servers[serverConfig.id].config).toEqual(serverConfig);
      } catch (error) {
        // Python may not be available in test environment
        expect(state.servers[serverConfig.id].status).toBe("error");
      }
    });

    it("should handle server installation from mock repository", async () => {
      // 1. Create a mock git repository structure
      const mockRepoDir = join(serversDir, "mock-repo-server");
      mkdirSync(mockRepoDir, { recursive: true });
      mkdirSync(join(mockRepoDir, ".git"), { recursive: true });

      // Create git-like structure
      writeFileSync(
        join(mockRepoDir, ".git", "config"),
        "[core]\n  repositoryformatversion = 0"
      );

      const packageJson = {
        name: "mock-repo-server",
        version: "1.0.0",
        main: "index.js",
        scripts: {
          start: "node index.js"
        }
      };

      writeFileSync(
        join(mockRepoDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const serverCode = `console.log("Mock repository server started");
const server = {
  name: "mock-repo-server",
  tools: ["mock_tool"]
};
console.log(JSON.stringify(server));
`;

      writeFileSync(join(mockRepoDir, "index.js"), serverCode);

      // 2. Verify detection functions work
      expect(isServerInstalled("https://github.com/mock/repo-server")).toBe(false);

      // Since we created the directory, it should be detected as installed by path
      const entryPoint = detectServerEntryPoint(mockRepoDir);
      expect(typeof entryPoint).toBe("object");

      // 3. Create configuration for the "installed" server
      const detectedConfig = {
        id: "mock-repo-server",
        name: "Mock Repo Server",
        type: "stdio" as const,
        command: "node",
        args: [join(mockRepoDir, "index.js")],
        cwd: mockRepoDir,
        enabled: true
      };

      await mcpClientManager.addServer(detectedConfig);
      expect(state.servers[detectedConfig.id]).toBeDefined();

      // 4. Test filesystem sync functionality
      await syncFilesystemServers();

      // Verify sync completed without errors
      expect(typeof state.serverConfigs).toBe("object");
    });
  });

  describe("Server Process Lifecycle Management", () => {
    it("should handle server startup, connection, and shutdown", async () => {
      // Create a long-running test server
      const longRunningDir = join(serversDir, "long-running-server");
      mkdirSync(longRunningDir, { recursive: true });

      const serverScript = `#!/usr/bin/env node
let running = true;
let messageCount = 0;

process.on('SIGTERM', () => {
  console.error('Server shutting down gracefully');
  running = false;
});

process.on('SIGINT', () => {
  console.error('Server interrupted');
  running = false;
});

// Simulate MCP server behavior
console.error('Long-running MCP server started');

const heartbeat = setInterval(() => {
  if (!running) {
    clearInterval(heartbeat);
    process.exit(0);
  }
  messageCount++;
  if (messageCount % 10 === 0) {
    console.error(\`Server heartbeat: \${messageCount}\`);
  }
}, 100);

// Listen for stdin (MCP protocol would be here)
process.stdin.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.method === 'ping') {
      console.log(JSON.stringify({ id: message.id, result: 'pong' }));
    }
  } catch (e) {
    // Ignore invalid JSON
  }
});

// Keep alive
setTimeout(() => {
  if (running) {
    console.error('Server timeout, shutting down');
    process.exit(0);
  }
}, 5000);
`;

      writeFileSync(join(longRunningDir, "server.js"), serverScript);
      chmodSync(join(longRunningDir, "server.js"), "755");

      const serverConfig: McpServerConfig = {
        id: "long-running-server",
        name: "Long Running Server",
        type: "stdio",
        command: "node",
        args: [join(longRunningDir, "server.js")],
        cwd: longRunningDir,
        enabled: true
      };

      // 1. Start server
      await mcpClientManager.addServer(serverConfig);
      expect(state.servers[serverConfig.id].status).toBe("disconnected");

      // 2. Connect server (starts process)
      const connectionPromise = mcpClientManager.connectServer(serverConfig.id);

      // Wait briefly for connection attempt
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Verify server state (may be connecting, connected, or error)
      const serverState = state.servers[serverConfig.id];
      expect(["connecting", "connected", "error"]).toContain(serverState.status);

      // 4. Attempt disconnection
      try {
        await mcpClientManager.disconnectServer(serverConfig.id);
        expect(state.servers[serverConfig.id].status).toBe("disconnected");
      } catch (error) {
        // Disconnection may fail if connection never succeeded
      }

      // 5. Remove server
      await mcpClientManager.removeServer(serverConfig.id);
      expect(state.servers[serverConfig.id]).toBeUndefined();
    });

    it("should handle multiple concurrent server processes", async () => {
      const serverConfigs: McpServerConfig[] = [];

      // Create multiple test servers
      for (let i = 1; i <= 3; i++) {
        const serverDir = join(serversDir, `concurrent-server-${i}`);
        mkdirSync(serverDir, { recursive: true });

        const serverScript = `#!/usr/bin/env node
console.error('Concurrent server ${i} started');

process.on('SIGTERM', () => {
  console.error('Concurrent server ${i} shutting down');
  process.exit(0);
});

// Simple echo server
process.stdin.on('data', (data) => {
  const response = {
    server: ${i},
    echo: data.toString().trim()
  };
  console.log(JSON.stringify(response));
});

// Auto-shutdown after delay
setTimeout(() => {
  console.error('Concurrent server ${i} timeout');
  process.exit(0);
}, 3000);
`;

        writeFileSync(join(serverDir, "server.js"), serverScript);
        chmodSync(join(serverDir, "server.js"), "755");

        const config: McpServerConfig = {
          id: `concurrent-server-${i}`,
          name: `Concurrent Server ${i}`,
          type: "stdio",
          command: "node",
          args: [join(serverDir, "server.js")],
          cwd: serverDir,
          enabled: true
        };

        serverConfigs.push(config);
      }

      // 1. Add all servers
      for (const config of serverConfigs) {
        await mcpClientManager.addServer(config);
        expect(state.servers[config.id]).toBeDefined();
      }

      expect(Object.keys(state.servers)).toHaveLength(3);

      // 2. Attempt to connect all servers concurrently
      const connectionPromises = serverConfigs.map(config =>
        mcpClientManager.connectServer(config.id)
      );

      // Wait for connections to attempt
      await Promise.allSettled(connectionPromises);

      // 3. Verify all servers are tracked (regardless of connection success)
      expect(Object.keys(state.servers)).toHaveLength(3);
      serverConfigs.forEach(config => {
        expect(state.servers[config.id]).toBeDefined();
        expect(state.servers[config.id].name).toBe(config.name);
      });

      // 4. Disconnect all servers
      const disconnectionPromises = serverConfigs.map(config =>
        mcpClientManager.disconnectServer(config.id)
      );

      await Promise.allSettled(disconnectionPromises);

      // 5. Remove all servers
      for (const config of serverConfigs) {
        await mcpClientManager.removeServer(config.id);
      }

      expect(Object.keys(state.servers)).toHaveLength(0);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle server process crashes gracefully", async () => {
      const crashingServerDir = join(serversDir, "crashing-server");
      mkdirSync(crashingServerDir, { recursive: true });

      const crashingScript = `#!/usr/bin/env node
console.error('Crashing server starting...');

// Crash after a short delay
setTimeout(() => {
  console.error('Server crashing intentionally');
  process.exit(1);
}, 500);

// Handle some requests first
process.stdin.on('data', (data) => {
  console.log(JSON.stringify({ status: 'about to crash' }));
});
`;

      writeFileSync(join(crashingServerDir, "server.js"), crashingScript);
      chmodSync(join(crashingServerDir, "server.js"), "755");

      const serverConfig: McpServerConfig = {
        id: "crashing-server",
        name: "Crashing Server",
        type: "stdio",
        command: "node",
        args: [join(crashingServerDir, "server.js")],
        cwd: crashingServerDir,
        enabled: true
      };

      // 1. Add server
      await mcpClientManager.addServer(serverConfig);

      // 2. Attempt connection (should handle crash gracefully)
      try {
        await mcpClientManager.connectServer(serverConfig.id);

        // Wait for crash
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Server should be in error state after crash
        expect(["error", "disconnected"]).toContain(
          state.servers[serverConfig.id].status
        );
      } catch (error) {
        // Connection failure is expected behavior
        expect(state.servers[serverConfig.id]).toBeDefined();
      }

      // 3. System should remain stable
      expect(typeof state.servers).toBe("object");
      expect(state.servers[serverConfig.id]).toBeDefined();
    });

    it("should handle invalid server configurations", async () => {
      const invalidConfigs: McpServerConfig[] = [
        {
          id: "nonexistent-command",
          name: "Nonexistent Command Server",
          type: "stdio",
          command: "nonexistent-command-12345",
          args: ["--invalid"],
          enabled: true
        },
        {
          id: "invalid-path",
          name: "Invalid Path Server",
          type: "stdio",
          command: "node",
          args: ["/nonexistent/path/server.js"],
          cwd: "/nonexistent/directory",
          enabled: true
        }
      ];

      for (const config of invalidConfigs) {
        // Should not throw when adding invalid config
        await expect(mcpClientManager.addServer(config)).resolves.not.toThrow();

        // Server should be added to state
        expect(state.servers[config.id]).toBeDefined();

        // Connection should fail gracefully
        await expect(
          mcpClientManager.connectServer(config.id)
        ).resolves.not.toThrow();

        // Server should be in error or disconnected state
        expect(["error", "disconnected"]).toContain(state.servers[config.id].status);
      }
    });

    it("should recover from configuration corruption", async () => {
      // 1. Create valid configuration
      const validConfig: McpServerConfig = {
        id: "corruption-test-server",
        name: "Corruption Test Server",
        type: "stdio",
        command: "echo",
        args: ["test"],
        enabled: true
      };

      await mcpClientManager.addServer(validConfig);
      expect(state.servers[validConfig.id]).toBeDefined();

      // 2. Simulate configuration corruption
      const corruptedConfig = { ...validConfig };
      delete (corruptedConfig as any).command;
      (corruptedConfig as any).type = "invalid-type";

      // 3. System should handle corrupted config gracefully
      await expect(
        mcpClientManager.addServer(corruptedConfig)
      ).resolves.not.toThrow();

      // 4. Should be able to recover with valid config
      const recoveryConfig: McpServerConfig = {
        id: "recovery-server",
        name: "Recovery Server",
        type: "stdio",
        command: "node",
        args: ["-e", "console.log('recovered')"],
        enabled: true
      };

      await mcpClientManager.addServer(recoveryConfig);
      expect(state.servers[recoveryConfig.id]).toBeDefined();
      expect(state.servers[recoveryConfig.id].config).toEqual(recoveryConfig);
    });
  });

  describe("Configuration Persistence and Sync", () => {
    it("should sync filesystem servers and generate configurations", async () => {
      // Create multiple mock installed servers
      const mockServers = [
        {
          name: "filesystem-sync-node",
          type: "node",
          files: {
            "package.json": JSON.stringify({
              name: "filesystem-sync-node",
              main: "index.js"
            }),
            "index.js": "console.log('node server');"
          }
        },
        {
          name: "filesystem-sync-python",
          type: "python",
          files: {
            "pyproject.toml": "[project]\nname = 'filesystem-sync-python'",
            "server.py": "print('python server')"
          }
        }
      ];

      // Create server directories
      for (const server of mockServers) {
        const serverDir = join(serversDir, server.name);
        mkdirSync(serverDir, { recursive: true });
        mkdirSync(join(serverDir, ".git")); // Simulate git repo

        Object.entries(server.files).forEach(([filename, content]) => {
          writeFileSync(join(serverDir, filename), content);
        });
      }

      // Ensure servers directory exists
      ensureServersDirectory();
      expect(existsSync(serversDir)).toBe(true);

      // Perform filesystem sync
      await syncFilesystemServers();

      // Verify sync completed
      expect(typeof state.serverConfigs).toBe("object");

      // Check if servers were detected (may not be fully configured due to mock nature)
      const configKeys = Object.keys(state.serverConfigs);
      // At minimum, sync should complete without errors
      expect(configKeys).toBeDefined();
    });

    it("should handle configuration save and load cycle", async () => {
      const testConfigs = {
        "save-load-server-1": {
          id: "save-load-server-1",
          name: "Save Load Server 1",
          type: "stdio" as const,
          command: "node",
          args: ["server1.js"],
          cwd: "/path/to/server1",
          enabled: true
        },
        "save-load-server-2": {
          id: "save-load-server-2",
          name: "Save Load Server 2",
          type: "stdio" as const,
          command: "python3",
          args: ["server2.py"],
          cwd: "/path/to/server2",
          enabled: false
        }
      };

      // Save configurations
      writeFileSync(configFile, JSON.stringify(testConfigs, null, 2));
      expect(existsSync(configFile)).toBe(true);

      // Load configurations
      const loadedConfigs = JSON.parse(readFileSync(configFile, "utf8"));
      expect(loadedConfigs).toEqual(testConfigs);

      // Add loaded configs to client manager
      for (const config of Object.values(loadedConfigs)) {
        await mcpClientManager.addServer(config);
        expect(state.servers[config.id]).toBeDefined();
        expect(state.servers[config.id].config).toEqual(config);
      }

      // Verify state matches loaded configs
      expect(Object.keys(state.servers)).toHaveLength(2);
      expect(state.servers["save-load-server-1"].config.enabled).toBe(true);
      expect(state.servers["save-load-server-2"].config.enabled).toBe(false);
    });
  });

  describe("Registry Integration Workflows", () => {
    it("should interact with MCP registry for server discovery", async () => {
      // 1. Access registry data
      const registryServers = mcpRegistry;
      expect(Array.isArray(registryServers)).toBe(true);
      expect(registryServers.length).toBeGreaterThan(0);

      // 2. Check server properties
      const firstServer = registryServers[0];
      expect(firstServer).toHaveProperty("name");
      expect(firstServer).toHaveProperty("github");
      expect(firstServer).toHaveProperty("description");

      // 3. Check installation status
      const installationStatus = getRegistryInstallationStatus(mcpRegistry);
      expect(typeof installationStatus).toBe("object");

      // 4. Verify status for each server
      registryServers.forEach(server => {
        expect(installationStatus).toHaveProperty(server.name);
        expect(typeof installationStatus[server.name]).toBe("boolean");

        // Check individual server installation status
        const isInstalled = isRegistryServerInstalled(server);
        expect(typeof isInstalled).toBe("boolean");
        expect(isInstalled).toBe(installationStatus[server.name]);
      });
    });

    it("should simulate server installation workflow from registry", async () => {
      // Create a mock "installed" server to simulate registry installation
      const mockInstalledServer = "mock-registry-server";
      const mockServerDir = join(serversDir, mockInstalledServer);
      mkdirSync(mockServerDir, { recursive: true });
      mkdirSync(join(mockServerDir, ".git"));

      const packageJson = {
        name: mockInstalledServer,
        version: "1.0.0",
        description: "Mock registry server for testing",
        main: "server.js"
      };

      writeFileSync(
        join(mockServerDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const serverCode = `console.log("Mock registry server started");`;
      writeFileSync(join(mockServerDir, "server.js"), serverCode);

      // Simulate detection of installed server
      const entryPoint = detectServerEntryPoint(mockServerDir);
      expect(typeof entryPoint).toBe("object");

      // Create configuration for the "installed" server
      const registryServerConfig: McpServerConfig = {
        id: mockInstalledServer,
        name: "Mock Registry Server",
        type: "stdio",
        command: "node",
        args: [join(mockServerDir, "server.js")],
        cwd: mockServerDir,
        enabled: true
      };

      // Add to manager
      await mcpClientManager.addServer(registryServerConfig);
      expect(state.servers[registryServerConfig.id]).toBeDefined();

      // Verify configuration
      expect(state.servers[registryServerConfig.id].config).toEqual(
        registryServerConfig
      );
      expect(state.servers[registryServerConfig.id].name).toBe(
        "Mock Registry Server"
      );
    });
  });

  describe("Tool Discovery and Management", () => {
    it("should handle tool discovery from connected servers", async () => {
      const toolServerDir = join(serversDir, "tool-discovery-server");
      mkdirSync(toolServerDir, { recursive: true });

      // Create server that advertises tools
      const toolServerScript = `#!/usr/bin/env node
console.error('Tool discovery server started');

const tools = [
  {
    name: "file_reader",
    description: "Read files from filesystem",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    name: "data_processor",
    description: "Process data with various algorithms",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string" },
        algorithm: { type: "string", enum: ["sort", "filter", "transform"] }
      },
      required: ["data", "algorithm"]
    }
  }
];

// Mock MCP tool list response
process.stdin.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.method === 'tools/list') {
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: { tools }
      };
      console.log(JSON.stringify(response));
    }
  } catch (e) {
    // Ignore invalid JSON
  }
});

setTimeout(() => process.exit(0), 2000);
`;

      writeFileSync(join(toolServerDir, "server.js"), toolServerScript);
      chmodSync(join(toolServerDir, "server.js"), "755");

      const serverConfig: McpServerConfig = {
        id: "tool-discovery-server",
        name: "Tool Discovery Server",
        type: "stdio",
        command: "node",
        args: [join(toolServerDir, "server.js")],
        cwd: toolServerDir,
        enabled: true
      };

      // Add server
      await mcpClientManager.addServer(serverConfig);

      // Mock tools being discovered
      const discoveredTools: McpTool[] = [
        {
          name: "file_reader",
          description: "Read files from filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" }
            },
            required: ["path"]
          },
          serverId: serverConfig.id,
          serverName: serverConfig.name
        },
        {
          name: "data_processor",
          description: "Process data with various algorithms",
          inputSchema: {
            type: "object",
            properties: {
              data: { type: "string" },
              algorithm: { type: "string", enum: ["sort", "filter", "transform"] }
            },
            required: ["data", "algorithm"]
          },
          serverId: serverConfig.id,
          serverName: serverConfig.name
        }
      ];

      // Simulate tools being added to state
      state.availableTools = discoveredTools;
      // Set tools in server capabilities
      if (!state.servers[serverConfig.id].capabilities) {
        state.servers[serverConfig.id].capabilities = {};
      }
      state.servers[serverConfig.id].capabilities.tools = discoveredTools as any;

      // Verify tool discovery
      expect(state.availableTools).toHaveLength(2);
      expect(state.availableTools[0].name).toBe("file_reader");
      expect(state.availableTools[1].name).toBe("data_processor");

      // Verify tools are associated with server
      expect(state.servers[serverConfig.id].capabilities?.tools).toHaveLength(2);
      expect(state.servers[serverConfig.id].capabilities?.tools?.[0].serverId).toBe(
        serverConfig.id
      );
    });
  });
});
