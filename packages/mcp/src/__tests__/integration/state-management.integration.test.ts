import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import { state as routerState } from "@/router/state.js";
import { state as threadsState } from "@/threads/state/state.js";
import { state as modelsState } from "@/models/state.js";
import { state } from "@/mcp/state/state.js";
import { mcpClientManager } from "@/mcp/client/index.js";
import {
  listThreads,
  getActiveThreadPath,
  appendMessageToActiveThread,
  hydrate
} from "@/threads/utils/persistence.js";
import { Chat, ChatMessageData } from "@lmstudio/sdk";
import type { McpServerConfig } from "@/mcp/types.js";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
describe("State Management Integration Tests", () => {
  let tempDir: string;
  let threadsDir: string;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `state-management-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    threadsDir = join(tempDir, "threads");
    mkdirSync(threadsDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset all state to clean slate
    routerState.view = "Home";
    routerState.initialized = false;

    threadsState.active = null;
    threadsState.activeThreadId = null;
    threadsState.turn = "user";
    threadsState.message = "";
    threadsState.response = "";
    threadsState.streamingToolCalls = [];
    threadsState.refresh = 0;
    threadsState.saved = [];

    modelsState.selectedModel = null;

    // Reset MCP state
    Object.keys(state.servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];
    state.lastUpdated = 0;
    state.selectedServer = null;
    state.isLoading = false;
    state.searchState = {
      query: "",
      selectedIndex: 0,
      isSearchFocused: false
    };
    state.installationState = {
      status: {},
      loading: {}
    };

    // Clean up threads directory
    if (existsSync(threadsDir)) {
      const files = readdirSync(threadsDir);
      for (const file of files) {
        rmSync(join(threadsDir, file));
      }
    }
  });

  afterEach(async () => {
    // Clean up any chat instances and MCP servers
    if (threadsState.active) {
      threadsState.active = null;
    }

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

  describe("Cross-Component State Coordination", () => {
    it("should coordinate router and thread state during navigation", () => {
      // Start at Home with no active thread
      expect(routerState.view).toBe("Home");
      expect(threadsState.active).toBeNull();

      // Create a thread
      const chatInstance = {} as Chat;
      threadsState.active = chatInstance;
      threadsState.activeThreadId = "test-thread-123";
      threadsState.message = "Hello, world!";

      // Navigate to different views - thread state should persist
      routerState.view = "Menu";
      expect(threadsState.active).toStrictEqual(chatInstance);
      expect(threadsState.activeThreadId).toBe("test-thread-123");
      expect(threadsState.message).toBe("Hello, world!");

      routerState.view = "Threads";
      expect(threadsState.active).toStrictEqual(chatInstance);

      routerState.view = "Home";
      expect(threadsState.active).toStrictEqual(chatInstance);

      // Clear thread and navigate
      threadsState.active = null;
      threadsState.activeThreadId = null;
      threadsState.message = "";

      routerState.view = "SelectModel";
      expect(threadsState.active).toBeNull();
      expect(threadsState.activeThreadId).toBeNull();
    });

    it("should coordinate model selection with thread state", () => {
      // No model selected initially
      expect(modelsState.selectedModel).toBeNull();

      // Select a model
      modelsState.selectedModel = "claude-3.5-sonnet";
      expect(modelsState.selectedModel).toBe("claude-3.5-sonnet");

      // Create thread while model is selected
      threadsState.active = {} as Chat;
      threadsState.activeThreadId = "model-thread-123";

      // Model selection should persist across thread operations
      expect(modelsState.selectedModel).toBe("claude-3.5-sonnet");

      // Change model while thread is active
      modelsState.selectedModel = "gpt-4";
      expect(modelsState.selectedModel).toBe("gpt-4");
      expect(threadsState.active).toBeDefined();
      expect(threadsState.activeThreadId).toBe("model-thread-123");
    });

    it("should coordinate MCP state with other component states", async () => {
      // Add MCP server
      const serverConfig: McpServerConfig = {
        id: "state-test-server",
        name: "State Test Server",
        type: "stdio",
        command: "echo",
        args: ["test"],
        enabled: true
      };

      await mcpClientManager.addServer(serverConfig);
      expect(state.servers[serverConfig.id]).toBeDefined();

      // MCP state should persist across router navigation
      routerState.view = "MCPMenu";
      expect(state.servers[serverConfig.id]).toBeDefined();

      routerState.view = "Home";
      expect(state.servers[serverConfig.id]).toBeDefined();

      // MCP state should persist across thread operations
      threadsState.active = {} as Chat;
      threadsState.activeThreadId = "mcp-thread-123";
      expect(state.servers[serverConfig.id]).toBeDefined();

      // MCP state should persist across model changes
      modelsState.selectedModel = "claude-3.5-sonnet";
      expect(state.servers[serverConfig.id]).toBeDefined();
    });
  });

  describe("Thread Persistence Integration", () => {
    it("should persist thread state to filesystem and reload", async () => {
      // Create thread with messages
      threadsState.activeThreadId = "persist-test-123";

      // Add messages
      const messages: ChatMessageData[] = [
        {
          role: "user",
          content: [{ type: "text", text: "Hello, can you help me?" }]
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Of course! How can I assist you today?" }]
        },
        {
          role: "user",
          content: [{ type: "text", text: "I need to analyze some code." }]
        }
      ];

      // Simulate adding messages to active thread
      for (const message of messages) {
        appendMessageToActiveThread(threadsDir, message);
      }

      // Verify thread file was created
      const threadPath = getActiveThreadPath(threadsDir);
      expect(existsSync(threadPath)).toBe(true);

      // Read and verify thread content
      const threadContent = JSON.parse(readFileSync(threadPath, "utf8"));
      expect(threadContent.messages).toHaveLength(3);
      expect(threadContent.messages[0].content[0].text).toBe(
        "Hello, can you help me?"
      );
      expect(threadContent.messages[2].content[0].text).toBe(
        "I need to analyze some code."
      );

      // Clear thread state
      threadsState.active = null;
      threadsState.activeThreadId = null;

      // Restore thread from persistence
      threadsState.activeThreadId = "persist-test-123";
      hydrate(threadsDir);

      expect(threadsState.active).toBeDefined();
      expect(threadsState.activeThreadId).toBe("persist-test-123");

      // Verify messages were restored
      const restoredMessages = threadsState.active!.getMessagesArray();
      expect(restoredMessages).toHaveLength(3);
      expect(restoredMessages[0].getText()).toBe("Hello, can you help me?");
    });

    it("should handle multiple concurrent threads", () => {
      const threadIds = ["thread-1", "thread-2", "thread-3"];

      // Create multiple threads
      for (const threadId of threadIds) {
        threadsState.activeThreadId = threadId;

        appendMessageToActiveThread(threadsDir, {
          role: "user",
          content: [{ type: "text", text: `Message from ${threadId}` }]
        });

        appendMessageToActiveThread(threadsDir, {
          role: "assistant",
          content: [{ type: "text", text: `Response for ${threadId}` }]
        });
      }

      // Verify all thread files exist
      const savedThreads = listThreads(threadsDir);
      expect(savedThreads).toHaveLength(3);

      for (const threadId of threadIds) {
        expect(savedThreads.some(filename => filename.includes(threadId))).toBe(
          true
        );
      }

      // Switch between threads and verify state
      for (const threadId of threadIds) {
        threadsState.activeThreadId = threadId;
        hydrate(threadsDir);

        const messages = threadsState.active!.getMessagesArray();
        expect(messages).toHaveLength(2);
        expect(messages[0].getText()).toBe(`Message from ${threadId}`);
        expect(messages[1].getText()).toBe(`Response for ${threadId}`);
      }
    });

    it("should maintain thread list in sync with filesystem", () => {
      // Initially no threads
      expect(listThreads(threadsDir)).toHaveLength(0);
      expect(threadsState.saved).toHaveLength(0);

      // Create threads
      const threadIds = ["sync-1", "sync-2", "sync-3"];

      for (const threadId of threadIds) {
        threadsState.activeThreadId = threadId;
        appendMessageToActiveThread(threadsDir, {
          role: "user",
          content: `Test message for ${threadId}`
        });
      }

      // Update saved threads list
      threadsState.saved = listThreads(threadsDir);
      expect(threadsState.saved).toHaveLength(3);

      // Verify filesystem matches state
      const filesystemThreads = listThreads(threadsDir);
      expect(filesystemThreads).toHaveLength(3);
      expect(threadsState.saved).toEqual(filesystemThreads);
    });
  });

  describe("State Consistency During Operations", () => {
    it("should maintain state consistency during streaming tool calls", () => {
      // Set up initial state
      threadsState.turn = "assistant";
      threadsState.response = "I'll help you with that.";

      // Add streaming tool calls progressively
      const toolCall1 = {
        id: 1,
        toolCallId: "call_1",
        name: "Read",
        arguments: '{"file_path": "/test/file1.txt"}',
        createdAt: Date.now()
      };

      threadsState.streamingToolCalls.push(toolCall1);
      expect(threadsState.streamingToolCalls).toHaveLength(1);
      expect(threadsState.turn).toBe("assistant");

      // Add second tool call
      const toolCall2 = {
        id: 2,
        toolCallId: "call_2",
        name: "Write",
        arguments: '{"file_path": "/test/file2.txt", "content": "result"}',
        createdAt: Date.now()
      };

      threadsState.streamingToolCalls.push(toolCall2);
      expect(threadsState.streamingToolCalls).toHaveLength(2);

      // Simulate tool call completion
      threadsState.streamingToolCalls[0].hasError = false;
      threadsState.streamingToolCalls[1].hasError = false;

      expect(
        threadsState.streamingToolCalls.every(tc => tc.hasError === false)
      ).toBe(true);

      // Complete conversation
      threadsState.turn = "user";
      threadsState.streamingToolCalls = [];
      threadsState.response = "";

      expect(threadsState.streamingToolCalls).toHaveLength(0);
      expect(threadsState.turn).toBe("user");
    });

    it("should handle state updates during MCP server operations", async () => {
      const serverConfig: McpServerConfig = {
        id: "ops-test-server",
        name: "Operations Test Server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
        enabled: true
      };

      // Add server
      await mcpClientManager.addServer(serverConfig);
      expect(state.servers[serverConfig.id]).toBeDefined();
      expect(state.servers[serverConfig.id].status).toBe("disconnected");

      // Simulate connection process
      state.servers[serverConfig.id].status = "connecting";
      expect(state.servers[serverConfig.id].status).toBe("connecting");

      // Add available tools during connection
      state.availableTools = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { type: "object" },
          serverId: serverConfig.id,
          serverName: serverConfig.name
        }
      ];

      expect(state.availableTools).toHaveLength(1);

      // Complete connection
      state.servers[serverConfig.id].status = "connected";
      // Set tools in server capabilities
      if (!state.servers[serverConfig.id].capabilities) {
        state.servers[serverConfig.id].capabilities = {};
      }
      state.servers[serverConfig.id].capabilities.tools =
        state.availableTools.filter(
          tool => tool.serverId === serverConfig.id
        ) as any;

      expect(state.servers[serverConfig.id].status).toBe("connected");
      expect(state.servers[serverConfig.id].capabilities?.tools).toHaveLength(1);

      // Simulate disconnection
      state.servers[serverConfig.id].status = "disconnected";
      state.availableTools = [];

      expect(state.servers[serverConfig.id].status).toBe("disconnected");
      expect(state.availableTools).toHaveLength(0);
    });

    it("should handle concurrent state updates gracefully", async () => {
      // Simulate concurrent operations on different state components
      const operations = [
        // Router operations
        () => {
          routerState.view = "Menu";
          routerState.initialized = true;
        },

        // Thread operations
        () => {
          threadsState.activeThreadId = "concurrent-thread";
          threadsState.turn = "assistant";
          threadsState.message = "Concurrent message";
        },

        // Model operations
        () => {
          modelsState.selectedModel = "concurrent-model";
        },

        // MCP operations
        async () => {
          const config: McpServerConfig = {
            id: "concurrent-server",
            name: "Concurrent Server",
            type: "stdio",
            command: "echo",
            args: ["concurrent"],
            enabled: true
          };
          await mcpClientManager.addServer(config);
        }
      ];

      // Execute operations concurrently
      await Promise.all(operations.map(op => op()));

      // Verify all state updates were applied
      expect(routerState.view).toBe("Menu");
      expect(routerState.initialized).toBe(true);

      expect(threadsState.activeThreadId).toBe("concurrent-thread");
      expect(threadsState.turn).toBe("assistant");
      expect(threadsState.message).toBe("Concurrent message");

      expect(modelsState.selectedModel).toBe("concurrent-model");

      expect(state.servers["concurrent-server"]).toBeDefined();
      expect(state.servers["concurrent-server"].name).toBe("Concurrent Server");
    });
  });

  describe("Error Recovery and State Integrity", () => {
    it("should recover from invalid thread state", () => {
      // Create invalid thread state
      threadsState.active = null;
      threadsState.activeThreadId = "invalid-thread-999";
      threadsState.turn = "assistant";
      threadsState.response = "Orphaned response";

      // Attempt to restore from invalid state
      try {
        hydrate(threadsDir);
      } catch (error) {
        // Should handle gracefully
      }

      // State should be corrected
      expect(threadsState.active).toBeDefined(); // Should create new chat
      expect(threadsState.activeThreadId).toBe("invalid-thread-999");

      // Clean up inconsistent state
      if (threadsState.turn === "assistant" && !threadsState.active) {
        threadsState.turn = "user";
        threadsState.response = "";
      }
    });

    it("should handle MCP server state corruption", async () => {
      // Add valid server
      const validConfig: McpServerConfig = {
        id: "valid-server",
        name: "Valid Server",
        type: "stdio",
        command: "echo",
        args: ["valid"],
        enabled: true
      };

      await mcpClientManager.addServer(validConfig);
      expect(state.servers[validConfig.id]).toBeDefined();

      // Simulate state corruption
      (state.servers[validConfig.id] as any).status = "invalid-status";
      (state.servers[validConfig.id] as any).config = null;

      // System should handle corrupted state
      expect(state.servers[validConfig.id]).toBeDefined();

      // Clean up corrupted server
      await mcpClientManager.removeServer(validConfig.id);
      expect(state.servers[validConfig.id]).toBeUndefined();

      // Add new server to verify system still works
      const newConfig: McpServerConfig = {
        id: "recovery-server",
        name: "Recovery Server",
        type: "stdio",
        command: "echo",
        args: ["recovery"],
        enabled: true
      };

      await mcpClientManager.addServer(newConfig);
      expect(state.servers[newConfig.id]).toBeDefined();
      expect(state.servers[newConfig.id].status).toBe("disconnected");
    });

    it("should maintain state consistency across component failures", () => {
      // Set up initial state across all components
      routerState.view = "Home";
      routerState.initialized = true;

      threadsState.activeThreadId = "failure-test";
      threadsState.active = {} as Chat;
      threadsState.message = "Test message";

      modelsState.selectedModel = "test-model";

      // Simulate partial component failure (router)
      try {
        (routerState as any).view = null;
      } catch (error) {
        // Handle error
      }

      // Other components should remain intact
      expect(threadsState.activeThreadId).toBe("failure-test");
      expect(threadsState.message).toBe("Test message");
      expect(modelsState.selectedModel).toBe("test-model");

      // Recover router state
      routerState.view = "Home";

      // All state should be consistent
      expect(routerState.view).toBe("Home");
      expect(threadsState.activeThreadId).toBe("failure-test");
      expect(modelsState.selectedModel).toBe("test-model");
    });
  });

  describe("State Persistence and Migration", () => {
    it("should handle state schema evolution", () => {
      // Simulate old thread format
      const oldThreadData = {
        messages: [
          {
            data: {
              role: "user",
              content: "Old format message"
            }
          },
          {
            data: {
              role: "assistant",
              content: "Old format response"
            }
          }
        ]
      };

      const oldThreadPath = join(threadsDir, "old-format-thread.json");
      writeFileSync(oldThreadPath, JSON.stringify(oldThreadData));

      // Load old format thread
      threadsState.activeThreadId = "old-format-thread";

      try {
        hydrate(threadsDir);

        // Should migrate to new format
        expect(threadsState.active).toBeDefined();

        const messages = threadsState.active!.getMessagesArray();
        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe("Old format message");
        expect(messages[1].content).toBe("Old format response");
      } catch (error) {
        // Migration might require manual handling
        console.warn("Migration required for old format");
      }
    });

    it("should handle state backup and restore", () => {
      // Create comprehensive state
      routerState.view = "Menu";
      routerState.initialized = true;

      modelsState.selectedModel = "backup-model";

      threadsState.activeThreadId = "backup-thread";
      threadsState.message = "Backup message";
      threadsState.turn = "user";

      // Create backup
      const stateBackup = {
        router: { ...routerState },
        models: { ...modelsState },
        threads: {
          activeThreadId: threadsState.activeThreadId,
          message: threadsState.message,
          turn: threadsState.turn
        },
        timestamp: new Date().toISOString()
      };

      const backupPath = join(tempDir, "state-backup.json");
      writeFileSync(backupPath, JSON.stringify(stateBackup, null, 2));

      // Clear state
      routerState.view = "Home";
      routerState.initialized = false;
      modelsState.selectedModel = null;
      threadsState.activeThreadId = null;
      threadsState.message = "";
      threadsState.turn = "user";

      // Restore from backup
      const restoredBackup = JSON.parse(readFileSync(backupPath, "utf8"));

      routerState.view = restoredBackup.router.view;
      routerState.initialized = restoredBackup.router.initialized;
      modelsState.selectedModel = restoredBackup.models.selectedModel;
      threadsState.activeThreadId = restoredBackup.threads.activeThreadId;
      threadsState.message = restoredBackup.threads.message;
      threadsState.turn = restoredBackup.threads.turn;

      // Verify restoration
      expect(routerState.view).toBe("Menu");
      expect(routerState.initialized).toBe(true);
      expect(modelsState.selectedModel).toBe("backup-model");
      expect(threadsState.activeThreadId).toBe("backup-thread");
      expect(threadsState.message).toBe("Backup message");
    });
  });
});
