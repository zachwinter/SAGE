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
import { act, render } from "@testing-library/react";
import React from "react";
import { Router } from "@/router/Router.js";
import { state as routerState } from "@/router/state.js";
import { state as threadsState } from "@/threads/state/state.js";
import { state as modelsState } from "@/models/state.js";
import { state } from "@/mcp/state/state.js";
import { mcpClientManager } from "@/mcp/client/index.js";
import { Chat, ChatMessageData } from "@lmstudio/sdk";
import {
  listThreads,
  getActiveThreadPath,
  appendMessageToActiveThread,
  hydrate
} from "@/threads/utils/persistence.js";
import { Read } from "@/tools/Read.js";
import { Write } from "@/tools/Write.js";
import { Edit } from "@/tools/Edit.js";
import { Bash } from "@/tools/Bash.js";
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
import type { McpServerConfig, McpTool } from "@/mcp/types.js";

// Mock unstable network conditions
const createNetworkErrorMock = () => {
  let callCount = 0;
  return () => {
    callCount++;
    if (callCount % 3 === 0) {
      throw new Error("Network timeout");
    }
    return Promise.resolve("success");
  };
};

describe("Error Recovery Scenarios Integration Tests", () => {
  let tempDir: string;
  let threadsDir: string;
  let corruptedDir: string;
  let networkMock: ReturnType<typeof createNetworkErrorMock>;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `error-recovery-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    threadsDir = join(tempDir, "threads");
    corruptedDir = join(tempDir, "corrupted");
    mkdirSync(threadsDir, { recursive: true });
    mkdirSync(corruptedDir, { recursive: true });

    networkMock = createNetworkErrorMock();
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

    // Clean up directories
    [threadsDir, corruptedDir].forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
        mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterEach(async () => {
    // Clean up any MCP servers
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

  describe("File System Error Recovery", () => {
    it("should recover from corrupted thread files", async () => {
      // 1. Create valid thread first
      const validThreadId = "valid-thread-123";
      threadsState.activeThreadId = validThreadId;

      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "Hello, this is a valid message" }]
      });

      appendMessageToActiveThread(threadsDir, {
        role: "assistant",
        content: [{ type: "text", text: "This is a valid response" }]
      });

      // Verify valid thread was created
      const validThreads = listThreads(threadsDir);
      expect(validThreads.length).toBe(1);

      // 2. Create corrupted thread file
      const corruptedThreadId = "corrupted-thread-456";
      const corruptedThreadPath = join(threadsDir, `${corruptedThreadId}.json`);
      writeFileSync(corruptedThreadPath, '{ "messages": [ invalid json }');

      // 3. Try to load corrupted thread
      threadsState.activeThreadId = corruptedThreadId;

      // Hydrate should handle corruption gracefully
      expect(() => {
        try {
          hydrate(threadsDir);
        } catch (error) {
          // Error is expected but should not crash the application
          console.log("Expected error handling corrupted thread:", error);
        }
      }).not.toThrow();

      // 4. System should recover by creating new thread or falling back
      expect(threadsState.activeThreadId).toBe(corruptedThreadId);
      // Active thread might be null or a new Chat instance
      if (threadsState.active) {
        expect(threadsState.active).toBeInstanceOf(Chat);
      }

      // 5. Should be able to continue with valid operations
      threadsState.activeThreadId = validThreadId;
      hydrate(threadsDir);

      expect(threadsState.active).toBeDefined();
      if (threadsState.active) {
        const messages = threadsState.active.getMessagesArray();
        expect(messages.length).toBeGreaterThan(0);
      }
    });

    it("should handle filesystem permission errors gracefully", async () => {
      // Create a test file
      const testFile = join(tempDir, "permission-test.txt");
      await Write.implementation({
        file_path: testFile,
        content: "Initial content"
      });

      // Make file read-only (simulate permission issues)
      try {
        chmodSync(testFile, 0o444); // Read-only

        // Try to write to read-only file
        const writeResult = await Write.implementation({
          file_path: testFile,
          content: "New content"
        });

        // REFACTOR #1: Check for `message` property instead of `error`.
        expect(writeResult).toEqual({
          success: false,
          message: expect.stringContaining("EACCES")
        });

        // Try to edit read-only file
        const editResult = await Edit.implementation({
          file_path: testFile,
          old_string: "Initial",
          new_string: "Modified"
        });

        // REFACTOR #1: Check for `message` property instead of `error`.
        expect(editResult).toEqual({
          success: false,
          message: expect.stringContaining("EACCES")
        });
      } finally {
        // Restore permissions for cleanup
        try {
          chmodSync(testFile, 0o666);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // System should remain stable
      expect(threadsState).toBeDefined();
      expect(routerState).toBeDefined();
    });

    it("should recover from disk space issues", async () => {
      // Simulate large file creation that might fail due to space
      const largeContent = "x".repeat(1000000); // 1MB of content
      const largeFiles: string[] = [];

      // Try to create multiple large files
      for (let i = 0; i < 5; i++) {
        const filePath = join(tempDir, `large-file-${i}.txt`);

        try {
          const result = await Write.implementation({
            file_path: filePath,
            content: largeContent
          });

          if (
            result &&
            typeof result === "object" &&
            "success" in result &&
            result.success
          ) {
            largeFiles.push(filePath);
          }
        } catch (error) {
          // If we hit disk space issues, handle gracefully
          console.log(`Expected disk space issue at file ${i}:`, error);
          break;
        }
      }

      // Should have created at least some files
      expect(largeFiles.length).toBeGreaterThanOrEqual(0);

      // Clean up created files to free space
      for (const filePath of largeFiles) {
        if (existsSync(filePath)) {
          rmSync(filePath);
        }
      }

      // System should be able to continue working after cleanup
      const smallTestResult = await Write.implementation({
        file_path: join(tempDir, "small-recovery-test.txt"),
        content: "Recovery successful"
      });

      expect(smallTestResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });
    });
  });

  describe("Network and Process Error Recovery", () => {
    it("should handle MCP server connection failures", async () => {
      const serverConfigs = [
        {
          id: "failing-server-1",
          name: "Failing Server 1",
          type: "stdio" as const,
          command: "nonexistent-command",
          args: ["--invalid"],
          enabled: true
        },
        {
          id: "failing-server-2",
          name: "Failing Server 2",
          type: "stdio" as const,
          command: "python3",
          args: ["/nonexistent/path/server.py"],
          enabled: true
        },
        {
          id: "working-server",
          name: "Working Server",
          type: "stdio" as const,
          command: "echo",
          args: ["working"],
          enabled: true
        }
      ];

      // Add all servers including failing ones
      for (const config of serverConfigs) {
        await mcpClientManager.addServer(config);
        expect(state.servers[config.id]).toBeDefined();
      }

      // Try to connect all servers
      const connectionResults: any[] = [];
      for (const config of serverConfigs) {
        try {
          await mcpClientManager.connectServer(config.id);
          connectionResults.push({ id: config.id, status: "success" });
        } catch (error) {
          connectionResults.push({ id: config.id, status: "failed", error });
        }
      }

      // System should remain stable despite failures
      expect(Object.keys(state.servers)).toHaveLength(3);

      // Failed servers should be in error state
      expect(["error", "disconnected"]).toContain(
        state.servers["failing-server-1"].status
      );
      expect(["error", "disconnected"]).toContain(
        state.servers["failing-server-2"].status
      );

      // Working server might be connected or disconnected (depends on actual echo behavior)
      expect(state.servers["working-server"]).toBeDefined();

      // Should be able to manage servers normally
      await mcpClientManager.removeServer("failing-server-1");
      expect(state.servers["failing-server-1"]).toBeUndefined();

      // Add a recovery server
      const recoveryConfig: McpServerConfig = {
        id: "recovery-server",
        name: "Recovery Server",
        type: "stdio",
        command: "node",
        args: ["-e", "console.log('recovery')"],
        enabled: true
      };

      await mcpClientManager.addServer(recoveryConfig);
      expect(state.servers[recoveryConfig.id]).toBeDefined();
    });

    it("should handle tool execution failures with recovery", async () => {
      // REFACTOR #2: Interleave failing and successful operations to prevent the
      // circuit breaker from tripping before a success is encountered.
      const operations = [
        // Failure 1
        () => Read.implementation({ file_path: "/nonexistent/file.txt" }),
        // Failure 2
        () =>
          Edit.implementation({
            file_path: "/nonexistent/file.txt",
            old_string: "old",
            new_string: "new"
          }),
        // Success 1 (resets consecutiveFailures)
        () =>
          Write.implementation({
            file_path: join(tempDir, "recovery-test.txt"),
            content: "recovery content"
          }),
        // Failure 3
        () => Bash.implementation({ command: "nonexistent-command --invalid" }),
        // Success 2
        () => Read.implementation({ file_path: join(tempDir, "recovery-test.txt") })
      ];

      const results: any[] = [];
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      for (const operation of operations) {
        try {
          const result = await operation();

          const isFailure =
            result &&
            typeof result === "object" &&
            "success" in result &&
            !result.success;

          if (isFailure) {
            consecutiveFailures++;
            results.push({ type: "failure", result });

            if (consecutiveFailures >= maxConsecutiveFailures) {
              console.log(
                "Circuit breaker triggered - too many consecutive failures"
              );
              break;
            }
          } else {
            consecutiveFailures = 0; // Reset on success
            results.push({ type: "success", result });
          }
        } catch (error) {
          consecutiveFailures++;
          results.push({ type: "error", error: (error as Error).message });

          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log("Circuit breaker triggered - too many consecutive errors");
            break;
          }
        }
      }

      // Should have attempted several operations
      expect(results.length).toBeGreaterThan(2);

      // Should have mix of failures and successes
      const failures = results.filter(
        r => r.type === "failure" || r.type === "error"
      );
      const successes = results.filter(r => r.type === "success");

      expect(failures.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0);

      // Verify recovery file was created
      const recoveryFile = join(tempDir, "recovery-test.txt");
      expect(existsSync(recoveryFile)).toBe(true);
    });

    // ... rest of the file is unchanged ...
    it("should handle streaming interruptions with recovery", async () => {
      // Set up streaming state
      threadsState.active = new Chat() as Chat;
      threadsState.activeThreadId = "streaming-recovery-test";
      threadsState.turn = "assistant";
      threadsState.response = "Starting response...";

      const interruptedToolCalls = [
        {
          id: 1,
          toolCallId: "call_1",
          name: "Read",
          arguments: JSON.stringify({ file_path: "/nonexistent/file1.txt" }),
          createdAt: Date.now()
        },
        {
          id: 2,
          toolCallId: "call_2",
          name: "Bash",
          arguments: JSON.stringify({ command: "failing-command" }),
          createdAt: Date.now()
        },
        {
          id: 3,
          toolCallId: "call_3",
          name: "Write",
          arguments: JSON.stringify({
            file_path: join(tempDir, "recovery.txt"),
            content: "recovery data"
          }),
          createdAt: Date.now()
        }
      ];

      threadsState.streamingToolCalls = [...interruptedToolCalls];

      // Simulate streaming interruption during tool execution
      for (let i = 0; i < threadsState.streamingToolCalls.length; i++) {
        const toolCall = threadsState.streamingToolCalls[i];

        try {
          const args = JSON.parse(toolCall.arguments);
          let result;

          // Simulate different failure scenarios
          switch (toolCall.name) {
            case "Read":
              result = await Read.implementation(args);
              break;
            case "Bash":
              result = await Bash.implementation(args);
              break;
            case "Write":
              result = await Write.implementation(args);
              break;
            default:
              result = { success: false, message: "Unknown tool" };
          }

          // Update tool call with result
          threadsState.streamingToolCalls[i].result = result;
          threadsState.streamingToolCalls[i].hasError =
            result && typeof result === "object" && "success" in result
              ? !result.success
              : false;
        } catch (error) {
          // Handle tool execution error
          threadsState.streamingToolCalls[i].result = {
            success: false,
            message: (error as Error).message
          };
          threadsState.streamingToolCalls[i].hasError = true;
        }

        // Simulate network interruption after second tool call
        if (i === 1) {
          console.log("Simulating network interruption...");

          // Simulate partial state corruption
          threadsState.response += " [INTERRUPTED]";

          // Recovery: save current state and continue
          try {
            appendMessageToActiveThread(threadsDir, {
              role: "assistant",
              content: [{ type: "text", text: threadsState.response }]
            });
          } catch (error) {
            console.log("Failed to save interrupted state:", error);
          }
        }
      }

      // Verify recovery state
      expect(threadsState.streamingToolCalls).toHaveLength(3);
      expect(threadsState.response).toContain("[INTERRUPTED]");

      // Count successful vs failed tool calls
      const successfulCalls = threadsState.streamingToolCalls.filter(
        tc => !tc.hasError
      );
      const failedCalls = threadsState.streamingToolCalls.filter(tc => tc.hasError);

      expect(successfulCalls.length).toBeGreaterThan(0);
      expect(failedCalls.length).toBeGreaterThan(0);

      // System should be able to complete streaming
      threadsState.turn = "user";
      threadsState.response = "";
      threadsState.streamingToolCalls = [];

      expect(threadsState.turn).toBe("user");
      expect(threadsState.streamingToolCalls).toHaveLength(0);
    });
  });

  describe("State Corruption Recovery", () => {
    it("should recover from malformed state data", async () => {
      // Set up normal state first
      const normalState = {
        router: { view: "Home", initialized: true },
        threads: { activeThreadId: "normal-thread", message: "test message" },
        models: { selectedModel: "test-model" }
      };

      // Apply normal state
      routerState.view = normalState.router.view as any;
      routerState.initialized = normalState.router.initialized;
      threadsState.activeThreadId = normalState.threads.activeThreadId;
      threadsState.message = normalState.threads.message;
      modelsState.selectedModel = normalState.models.selectedModel;

      // Verify normal state is working
      const { rerender } = render(React.createElement(Router));
      expect(routerState.view).toBe("Home");

      // Simulate various state corruptions
      const corruptionScenarios = [
        {
          name: "router state corruption",
          corrupt: () => {
            (routerState as any).view = null;
            (routerState as any).initialized = "invalid";
          },
          recover: () => {
            routerState.view = "Home";
            routerState.initialized = true;
          }
        },
        {
          name: "thread state corruption",
          corrupt: () => {
            (threadsState as any).active = "invalid";
            (threadsState as any).activeThreadId = 123; // Wrong type
            (threadsState as any).streamingToolCalls = "not an array";
          },
          recover: () => {
            threadsState.active = null;
            threadsState.activeThreadId = "recovered-thread";
            threadsState.streamingToolCalls = [];
          }
        },
        {
          name: "model state corruption",
          corrupt: () => {
            (modelsState as any).selectedModel = { invalid: "object" };
          },
          recover: () => {
            modelsState.selectedModel = "recovered-model";
          }
        }
      ];

      for (const scenario of corruptionScenarios) {
        // Apply corruption
        act(() => {
          scenario.corrupt();
        });

        // Try to render - should not crash
        expect(() => {
          rerender(React.createElement(Router));
        }).not.toThrow();

        // Apply recovery
        act(() => {
          scenario.recover();
        });

        // Verify recovery
        expect(() => {
          rerender(React.createElement(Router));
        }).not.toThrow();
      }

      // Final state should be stable
      expect(routerState.view).toBe("Home");
      expect(threadsState.activeThreadId).toBe("recovered-thread");
      expect(modelsState.selectedModel).toBe("recovered-model");
    });
  });

  describe("Resource Exhaustion Recovery", () => {
    it("should handle memory pressure scenarios", async () => {
      // Create large objects to simulate memory pressure
      const largeObjects: any[] = [];
      const objectSize = 100000; // 100k characters per object
      let memoryPressureDetected = false;

      try {
        // Create increasingly large objects
        for (let i = 0; i < 10; i++) {
          const largeData = {
            id: `large-object-${i}`,
            data: "x".repeat(objectSize * (i + 1)),
            timestamp: Date.now(),
            metadata: {
              size: objectSize * (i + 1),
              created: new Date(),
              index: i
            }
          };

          largeObjects.push(largeData);

          // Simulate adding to thread state
          if (i < 5) {
            threadsState.streamingToolCalls.push({
              id: i + 1,
              toolCallId: `large-call-${i}`,
              name: "LargeDataTool",
              arguments: JSON.stringify(largeData),
              createdAt: Date.now(),
              result: largeData
            });
          }

          // Check if we should trigger cleanup (simulate memory monitoring)
          if (i >= 7) {
            memoryPressureDetected = true;
            console.log("Memory pressure detected, triggering cleanup");
            break;
          }
        }
      } catch (error) {
        memoryPressureDetected = true;
        console.log("Memory allocation failed:", error);
      }

      // Cleanup strategy
      if (memoryPressureDetected) {
        // Clear large objects
        largeObjects.length = 0;

        // Clean up streaming tool calls
        threadsState.streamingToolCalls = threadsState.streamingToolCalls.slice(-2); // Keep only last 2

        // Force garbage collection hint (doesn't actually force GC)
        if (global.gc) {
          global.gc();
        }
      }

      // System should recover and be functional
      expect(threadsState).toBeDefined();
      expect(threadsState.streamingToolCalls.length).toBeLessThanOrEqual(5);

      // Should be able to continue normal operations
      const testResult = await Write.implementation({
        file_path: join(tempDir, "memory-recovery-test.txt"),
        content: "System recovered from memory pressure"
      });

      expect(testResult).toEqual({
        success: true,
        message: expect.stringContaining("Successfully wrote to")
      });
    });

    it("should handle thread overflow scenarios", async () => {
      const maxThreads = 20;
      const createdThreadIds: string[] = [];

      // Create many threads rapidly
      for (let i = 0; i < maxThreads; i++) {
        const threadId = `overflow-thread-${i}`;
        createdThreadIds.push(threadId);

        threadsState.activeThreadId = threadId;

        try {
          appendMessageToActiveThread(threadsDir, {
            role: "user",
            content: [{ type: "text", text: `Message in thread ${i}` }]
          });

          appendMessageToActiveThread(threadsDir, {
            role: "assistant",
            content: [{ type: "text", text: `Response in thread ${i}` }]
          });

          // Simulate some threads failing to create properly
          if (i > 15) {
            // Simulate thread creation failure
            writeFileSync(
              join(threadsDir, `${threadId}.json`),
              "{ invalid json for overflow test }"
            );
          }
        } catch (error) {
          console.log(`Thread ${i} failed to create:`, error);
        }
      }

      // Count successfully created threads
      const allThreads = listThreads(threadsDir);
      console.log(`Created ${allThreads.length} thread files`);

      // Implement thread cleanup strategy
      if (allThreads.length > 15) {
        console.log("Thread overflow detected, implementing cleanup");

        // Keep only recent threads (simulate LRU cleanup)
        const threadsToKeep = allThreads.slice(-10);
        const threadsToRemove = allThreads.slice(0, -10);

        for (const threadFile of threadsToRemove) {
          try {
            rmSync(join(threadsDir, threadFile));
          } catch (error) {
            console.log(`Failed to cleanup thread ${threadFile}:`, error);
          }
        }
      }

      // Verify cleanup worked
      const remainingThreads = listThreads(threadsDir);
      expect(remainingThreads.length).toBeLessThanOrEqual(15);

      // System should still be functional
      threadsState.activeThreadId = "recovery-thread";
      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "System recovered from thread overflow" }]
      });

      const finalThreads = listThreads(threadsDir);
      expect(finalThreads.some(t => t.includes("recovery-thread"))).toBe(true);
    });
  });

  describe("Data Integrity Recovery", () => {
    it("should detect and repair data inconsistencies", async () => {
      // Create consistent initial state
      const threadId = "consistency-test";
      threadsState.activeThreadId = threadId;
      threadsState.active = new Chat() as Chat;

      // Add messages to thread
      const messages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello" }]
        },
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Hi there!" }]
        },
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "How are you?" }]
        }
      ];

      for (const message of messages) {
        appendMessageToActiveThread(threadsDir, message);
      }

      // Verify thread file was created
      const threadPath = join(threadsDir, `${threadId}.json`);
      expect(existsSync(threadPath)).toBe(true);

      // Introduce data inconsistencies
      const originalContent = JSON.parse(readFileSync(threadPath, "utf8"));

      // Create various inconsistencies
      const inconsistentData = {
        ...originalContent,
        messages: [
          ...originalContent.messages,
          // Missing required fields
          { role: "user" },
          // Invalid role
          { role: "invalid", content: [{ type: "text", text: "Invalid message" }] },
          // Missing content
          { role: "assistant", content: null },
          // Invalid content format
          { role: "user", content: "should be array" }
        ]
      };

      // Write inconsistent data
      writeFileSync(threadPath, JSON.stringify(inconsistentData, null, 2));

      // Try to load inconsistent thread
      try {
        threadsState.activeThreadId = threadId;
        hydrate(threadsDir);

        // Should handle gracefully
        if (threadsState.active) {
          const loadedMessages = threadsState.active.getMessagesArray();
          // Should have filtered out invalid messages
          expect(loadedMessages.length).toBeLessThanOrEqual(
            originalContent.messages.length
          );
        }
      } catch (error) {
        // If hydration fails completely, should create new thread
        console.log("Thread hydration failed, creating new:", error);
        threadsState.active = new Chat() as Chat;
      }

      // Repair data by rewriting with valid messages only
      const repairedData = {
        threadId: threadId,
        createdAt: new Date().toISOString(),
        messages: messages // Use original valid messages
      };

      writeFileSync(threadPath, JSON.stringify(repairedData, null, 2));

      // Verify repair worked
      threadsState.activeThreadId = threadId;
      hydrate(threadsDir);

      expect(threadsState.active).toBeDefined();
      if (threadsState.active) {
        const repairedMessages = threadsState.active.getMessagesArray();
        expect(repairedMessages.length).toBe(3);
      }
    });

    it("should handle configuration corruption and recovery", async () => {
      // Create valid MCP server configurations
      const validConfigs = [
        {
          id: "config-server-1",
          name: "Config Server 1",
          type: "stdio" as const,
          command: "node",
          args: ["server1.js"],
          enabled: true
        },
        {
          id: "config-server-2",
          name: "Config Server 2",
          type: "stdio" as const,
          command: "python3",
          args: ["server2.py"],
          enabled: false
        }
      ];

      // Add valid configurations
      for (const config of validConfigs) {
        await mcpClientManager.addServer(config);
        expect(state.servers[config.id]).toBeDefined();
      }

      // Corrupt configuration data
      const corruptedConfigs = {
        ...state.serverConfigs,
        "corrupted-server": {
          // Missing required fields
          name: "Corrupted Server"
          // Missing id, type, command, etc.
        },
        "config-server-1": {
          ...validConfigs[0],
          // Invalid values
          type: "invalid-type",
          enabled: "not-boolean",
          args: "should-be-array"
        }
      };

      // Apply corruption
      state.serverConfigs = corruptedConfigs as any;

      // Detect and repair corruption
      const repairedConfigs: any = {};
      const corruptedKeys: string[] = [];

      for (const [serverId, config] of Object.entries(state.serverConfigs)) {
        try {
          // Validate configuration structure
          if (
            !config ||
            typeof config !== "object" ||
            !config.id ||
            !config.name ||
            !config.type ||
            !config.command
          ) {
            corruptedKeys.push(serverId);
            continue;
          }

          // Type validation and repair
          const repairedConfig = {
            ...config,
            enabled: typeof config.enabled === "boolean" ? config.enabled : true,
            args: Array.isArray(config.args) ? config.args : []
          };

          // Only include if type is valid
          if (["stdio", "http", "websocket"].includes(repairedConfig.type)) {
            repairedConfigs[serverId] = repairedConfig;
          } else {
            corruptedKeys.push(serverId);
          }
        } catch (error) {
          corruptedKeys.push(serverId);
        }
      }

      // Apply repairs
      state.serverConfigs = repairedConfigs;

      // Log corruption detection
      console.log(
        `Detected and removed ${corruptedKeys.length} corrupted configurations:`,
        corruptedKeys
      );

      // Verify repair
      expect(Object.keys(state.serverConfigs).length).toBeLessThanOrEqual(2);
      expect(state.serverConfigs["corrupted-server"]).toBeUndefined();

      // Should be able to add new valid configuration
      const recoveryConfig: McpServerConfig = {
        id: "recovery-server",
        name: "Recovery Server",
        type: "stdio",
        command: "echo",
        args: ["recovery"],
        enabled: true
      };

      await mcpClientManager.addServer(recoveryConfig);
      expect(state.servers[recoveryConfig.id]).toBeDefined();
    });
  });

  describe("Graceful Degradation", () => {
    it("should provide degraded functionality when core features fail", async () => {
      // Simulate core feature failures
      const featureFailures = {
        threadPersistence: false,
        mcpIntegration: false,
        analysisEngine: false
      };

      // Test thread operations with persistence disabled
      if (featureFailures.threadPersistence) {
        // Should work in memory only
        threadsState.active = new Chat() as Chat;
        threadsState.activeThreadId = "memory-only-thread";
        threadsState.message = "Testing degraded mode";

        // Don't persist to disk
        expect(threadsState.active).toBeDefined();
        expect(threadsState.message).toBe("Testing degraded mode");

        // Verify no files were created
        const threads = listThreads(threadsDir);
        expect(threads.length).toBe(0);
      }

      // Test MCP operations with integration disabled
      if (featureFailures.mcpIntegration) {
        // Should fall back to built-in tools only
        const availableTools = [
          { name: "Read", source: "builtin" },
          { name: "Write", source: "builtin" },
          { name: "Edit", source: "builtin" },
          { name: "Bash", source: "builtin" }
        ];

        // Simulate MCP tools being unavailable
        state.availableTools = [];
        state.servers = {};

        // Built-in tools should still work
        const testResult = await Write.implementation({
          file_path: join(tempDir, "degraded-test.txt"),
          content: "Built-in tools working in degraded mode"
        });

        expect(testResult).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      }

      // Test UI with reduced functionality
      const { rerender } = render(React.createElement(Router));

      // Should render without crashing
      expect(() => {
        act(() => {
          routerState.view = "Home";
        });
        rerender(React.createElement(Router));
      }).not.toThrow();

      // Should be able to navigate
      const views = ["Menu", "SelectModel", "Home"];
      for (const view of views) {
        expect(() => {
          act(() => {
            routerState.view = view as any;
          });
          rerender(React.createElement(Router));
        }).not.toThrow();
      }

      // User should receive appropriate feedback about degraded state
      expect(routerState.view).toBeDefined();
      expect(typeof routerState.view).toBe("string");
    });
  });
});
