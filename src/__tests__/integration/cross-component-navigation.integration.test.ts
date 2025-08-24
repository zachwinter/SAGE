/** @vitest-environment jsdom */
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
import { snapshot } from "valtio";
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
import type { McpServerConfig, McpTool } from "@/mcp/types.js";

describe("Cross-Component Navigation Integration Tests", () => {
  let tempDir: string;
  let threadsDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `cross-component-nav-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    threadsDir = join(tempDir, "threads");
    mkdirSync(threadsDir, { recursive: true });
  });

  afterAll(() => {
    process.chdir(originalCwd);
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
    Object.keys(snapshot(state).servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.serverConfigs = {};
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];
    state.lastUpdated = 0;
    state.selectedServer = null;
    state.isLoading = false;

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

    const serverIds = Object.keys(snapshot(state).servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.disconnectServer(serverId);
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Complete User Journey Workflows", () => {
    it("should handle full user journey: startup → model selection → conversation → tool use → threads management", async () => {
      // 1. App startup - user sees Home screen
      expect(routerState.view).toBe("Home");
      expect(routerState.initialized).toBe(false);

      // Render initial view
      const { rerender } = render(React.createElement(Router));
      expect(routerState.view).toBe("Home");

      // 2. User navigates to model selection
      act(() => {
        routerState.view = "SelectModel";
        routerState.initialized = true;
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("SelectModel");
      expect(routerState.initialized).toBe(true);

      // 3. User selects a model
      act(() => {
        modelsState.selectedModel = "claude-3.5-sonnet";
      });

      expect(modelsState.selectedModel).toBe("claude-3.5-sonnet");

      // 4. User returns to Home to start conversation
      act(() => {
        routerState.view = "Home";
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "user-journey-thread-1";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("Home");
      expect(threadsState.active).toBeDefined();

      // 5. User sends first message
      act(() => {
        threadsState.message = "Hello, can you help me analyze some code?";
        threadsState.turn = "assistant";
      });

      // Simulate adding message to thread persistence
      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [
          { type: "text", text: "Hello, can you help me analyze some code?" }
        ]
      });

      // 6. Assistant responds with tool use
      act(() => {
        threadsState.response = "I'll help you analyze code. Let me use some tools.";
        threadsState.streamingToolCalls.push({
          id: 1,
          toolCallId: "call_code_analysis",
          name: "Read",
          arguments: JSON.stringify({ file_path: "/project/main.js" }),
          createdAt: Date.now()
        });
      });

      // Simulate assistant response being added to persistence
      appendMessageToActiveThread(threadsDir, {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'll help you analyze code. Let me use some tools."
          }
        ]
      });

      // 7. User navigates to threads view to see conversation history
      act(() => {
        routerState.view = "Threads";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("Threads");

      // Thread state should persist across navigation
      expect(threadsState.active).toBeDefined();
      expect(threadsState.activeThreadId).toBe("user-journey-thread-1");
      expect(threadsState.response).toContain("I'll help you analyze code");

      // Verify thread was persisted to filesystem
      const savedThreads = listThreads(threadsDir);
      expect(savedThreads.length).toBeGreaterThan(0);
      expect(
        savedThreads.some(thread => thread.includes("user-journey-thread-1"))
      ).toBe(true);

      // 8. User goes back to Home and continues conversation
      act(() => {
        routerState.view = "Home";
        threadsState.message = "Can you also read another file?";
        threadsState.turn = "assistant";
      });

      // Add follow-up message
      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "Can you also read another file?" }]
      });

      // 9. Verify full state consistency
      expect(routerState.view).toBe("Home");
      expect(modelsState.selectedModel).toBe("claude-3.5-sonnet");
      expect(threadsState.activeThreadId).toBe("user-journey-thread-1");
      expect(threadsState.streamingToolCalls).toHaveLength(1);

      // Verify thread file contains all messages
      const threadPath = getActiveThreadPath(threadsDir);
      expect(existsSync(threadPath)).toBe(true);

      const threadContent = JSON.parse(readFileSync(threadPath, "utf8"));
      expect(threadContent.messages).toHaveLength(3); // user + assistant + user
      expect(threadContent.messages[0].content[0].text).toBe(
        "Hello, can you help me analyze some code?"
      );
      expect(threadContent.messages[2].content[0].text).toBe(
        "Can you also read another file?"
      );
    });

    it("should handle MCP discovery and integration user journey", async () => {
      // 1. User starts at Home
      expect(routerState.view).toBe("Home");

      // 2. User navigates to discover MCP servers
      act(() => {
        routerState.view = "DiscoverMCP";
      });

      const { rerender } = render(React.createElement(Router));
      expect(routerState.view).toBe("DiscoverMCP");

      // 3. User discovers available servers (mock some servers)
      act(() => {
        state.isLoading = true;
      });

      act(() => {
        state.isLoading = false;
      });

      // 4. User navigates to manage MCP servers
      act(() => {
        routerState.view = "ManageMCP";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("ManageMCP");

      // 5. User adds an MCP server
      const serverConfig: McpServerConfig = {
        id: "user-journey-server",
        name: "User Journey Server",
        type: "stdio",
        command: "python",
        args: ["-m", "journey_server"],
        enabled: true
      };

      await act(async () => {
        await mcpClientManager.addServer(serverConfig);
      });

      expect(state.servers[serverConfig.id]).toBeDefined();
      expect(state.servers[serverConfig.id].status).toBe("disconnected");

      // 6. Mock server connection and tool discovery
      act(() => {
        state.servers[serverConfig.id].status = "connected";
        state.availableTools = [
          {
            name: "journey_analyze",
            description: "Analyze user journey data",
            inputSchema: {
              type: "object",
              properties: {
                data: { type: "string" }
              }
            },
            serverId: serverConfig.id,
            serverName: serverConfig.name
          }
        ];
      });

      // 7. User navigates to view MCP tools
      act(() => {
        routerState.view = "MCPTools";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("MCPTools");
      expect(state.availableTools).toHaveLength(1);
      expect(state.availableTools[0].name).toBe("journey_analyze");

      // 8. User returns to chat to use MCP tools
      act(() => {
        routerState.view = "Home";
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "mcp-journey-thread";
        threadsState.message = "Please analyze my user journey";
        threadsState.turn = "assistant";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("Home");

      // 9. Simulate assistant using MCP tool
      act(() => {
        threadsState.response = "I'll analyze your user journey using the MCP tool.";
        threadsState.streamingToolCalls.push({
          id: 1,
          toolCallId: "call_journey_analyze",
          name: "journey_analyze",
          arguments: JSON.stringify({ data: "user navigation data" }),
          createdAt: Date.now()
        });
      });

      // 10. Verify complete MCP integration state
      expect(routerState.view).toBe("Home");
      expect(state.servers[serverConfig.id].status).toBe("connected");
      expect(state.availableTools[0].name).toBe("journey_analyze");
      expect(threadsState.streamingToolCalls[0].name).toBe("journey_analyze");
      expect(threadsState.response).toContain("analyze your user journey");

      // 11. User navigates back to MCP menu to manage servers
      act(() => {
        routerState.view = "MCPMenu";
      });

      rerender(React.createElement(Router));
      expect(routerState.view).toBe("MCPMenu");

      // MCP state should persist
      expect(state.servers[serverConfig.id]).toBeDefined();
      expect(state.availableTools).toHaveLength(1);

      // Thread state should also persist
      expect(threadsState.activeThreadId).toBe("mcp-journey-thread");
      expect(threadsState.streamingToolCalls).toHaveLength(1);
    });

    it("should handle multi-thread workflow with navigation", async () => {
      // 1. Create first thread
      act(() => {
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "multi-thread-1";
        threadsState.message = "First thread message";
      });

      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "First thread message" }]
      });

      appendMessageToActiveThread(threadsDir, {
        role: "assistant",
        content: [{ type: "text", text: "First thread response" }]
      });

      // 2. Create second thread
      act(() => {
        threadsState.activeThreadId = "multi-thread-2";
        threadsState.message = "Second thread message";
      });

      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "Second thread message" }]
      });

      appendMessageToActiveThread(threadsDir, {
        role: "assistant",
        content: [{ type: "text", text: "Second thread response with tools" }]
      });

      // 3. Create third thread with tool calls
      act(() => {
        threadsState.activeThreadId = "multi-thread-3";
        threadsState.message = "Third thread with analysis";
        threadsState.streamingToolCalls = [
          {
            id: 1,
            toolCallId: "call_analysis",
            name: "Read",
            arguments: JSON.stringify({ file_path: "/code/analysis.js" }),
            createdAt: Date.now()
          }
        ];
      });

      appendMessageToActiveThread(threadsDir, {
        role: "user",
        content: [{ type: "text", text: "Third thread with analysis" }]
      });

      // 4. Navigate to threads view
      act(() => {
        routerState.view = "Threads";
      });

      const { rerender } = render(React.createElement(Router));
      expect(routerState.view).toBe("Threads");

      // 5. Verify all threads are saved
      const savedThreads = listThreads(threadsDir);
      expect(savedThreads).toHaveLength(3);

      // Update saved threads in state
      act(() => {
        threadsState.saved = savedThreads;
      });

      expect(threadsState.saved).toHaveLength(3);

      // 6. Switch back to first thread
      act(() => {
        threadsState.activeThreadId = "multi-thread-1";
        hydrate(threadsDir);
        routerState.view = "Home";
      });

      rerender(React.createElement(Router));

      // Verify we switched back to first thread context
      expect(threadsState.activeThreadId).toBe("multi-thread-1");
      expect(routerState.view).toBe("Home");

      // 7. Switch to third thread (the one with tool calls)
      act(() => {
        threadsState.activeThreadId = "multi-thread-3";
        hydrate(threadsDir);
      });

      // Verify tool call state is maintained
      expect(threadsState.activeThreadId).toBe("multi-thread-3");
      // Note: streamingToolCalls are typically ephemeral and may not persist

      // 8. Navigate through different views while maintaining thread context
      const viewSequence = ["Menu", "MCPMenu", "Threads", "Home"];

      for (const view of viewSequence) {
        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));

        // Thread context should persist
        expect(threadsState.activeThreadId).toBe("multi-thread-3");
        expect(routerState.view).toBe(view);
      }

      // 9. Final verification of persistent state
      expect(routerState.view).toBe("Home");
      expect(threadsState.activeThreadId).toBe("multi-thread-3");
      expect(listThreads(threadsDir)).toHaveLength(3);
    });
  });

  describe("State Persistence Across Navigation", () => {
    it("should maintain model selection across all navigation", async () => {
      // 1. Select a model
      act(() => {
        modelsState.selectedModel = "gpt-4";
        routerState.view = "SelectModel";
      });

      const { rerender } = render(React.createElement(Router));
      expect(modelsState.selectedModel).toBe("gpt-4");

      // 2. Navigate through all views
      const allViews = [
        "Home",
        "Menu",
        "Threads",
        "SelectModel",
        "DiscoverMCP",
        "MCPMenu",
        "MCPTools",
        "ManageMCP"
      ];

      for (const view of allViews) {
        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));

        // Model selection should persist
        expect(modelsState.selectedModel).toBe("gpt-4");
        expect(routerState.view).toBe(view);
      }

      // 3. Change model in middle of navigation
      act(() => {
        routerState.view = "SelectModel";
        modelsState.selectedModel = "claude-3-opus";
      });

      // 4. Continue navigation
      const remainingViews = ["Home", "Threads", "MCPMenu"];

      for (const view of remainingViews) {
        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));
        expect(modelsState.selectedModel).toBe("claude-3-opus");
      }
    });

    it("should maintain MCP server state during navigation flows", async () => {
      // 1. Set up MCP servers
      const serverConfigs = [
        {
          id: "persistent-server-1",
          name: "Persistent Server 1",
          type: "stdio" as const,
          command: "echo",
          args: ["server1"],
          enabled: true
        },
        {
          id: "persistent-server-2",
          name: "Persistent Server 2",
          type: "stdio" as const,
          command: "echo",
          args: ["server2"],
          enabled: false
        }
      ];

      for (const config of serverConfigs) {
        await act(async () => {
          await mcpClientManager.addServer(config);
        });
      }

      // 2. Add some tools
      act(() => {
        state.availableTools = [
          {
            name: "persistent_tool_1",
            description: "Tool 1",
            inputSchema: { type: "object" },
            serverId: "persistent-server-1",
            serverName: "Persistent Server 1"
          },
          {
            name: "persistent_tool_2",
            description: "Tool 2",
            inputSchema: { type: "object" },
            serverId: "persistent-server-2",
            serverName: "Persistent Server 2"
          }
        ];
      });

      // 3. Navigate through MCP-related views
      const mcpViews = ["MCPMenu", "MCPTools", "ManageMCP", "DiscoverMCP"];
      const { rerender } = render(React.createElement(Router));

      for (const view of mcpViews) {
        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));

        // Verify MCP state persists
        expect(Object.keys(snapshot(state).servers)).toHaveLength(2);
        expect(state.servers["persistent-server-1"]).toBeDefined();
        expect(state.servers["persistent-server-2"]).toBeDefined();
        expect(state.availableTools).toHaveLength(2);
      }

      // 4. Navigate to non-MCP views
      const otherViews = ["Home", "Threads", "Menu"];

      for (const view of otherViews) {
        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));

        // MCP state should still persist
        expect(Object.keys(snapshot(state).servers)).toHaveLength(2);
        expect(state.availableTools).toHaveLength(2);
      }

      // 5. Modify MCP state during navigation
      act(() => {
        routerState.view = "MCPMenu";
        state.selectedServer = "persistent-server-1";
      });

      act(() => {
        routerState.view = "Home";
      });

      // Selection should persist
      expect(state.selectedServer).toBe("persistent-server-1");

      act(() => {
        routerState.view = "MCPTools";
      });

      expect(state.selectedServer).toBe("persistent-server-1");
    });

    it("should handle complex state combinations during navigation", async () => {
      // Set up complex initial state
      act(() => {
        // Router state
        routerState.view = "Home";
        routerState.initialized = true;

        // Model state
        modelsState.selectedModel = "claude-3.5-sonnet";

        // Thread state
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "complex-state-thread";
        threadsState.message = "Complex state message";
        threadsState.turn = "assistant";
        threadsState.response = "Processing your request...";
        threadsState.streamingToolCalls = [
          {
            id: 1,
            toolCallId: "call_complex",
            name: "Read",
            arguments: JSON.stringify({ file_path: "/complex/file.txt" }),
            createdAt: Date.now()
          }
        ];
      });

      // Add MCP server
      const serverConfig: McpServerConfig = {
        id: "complex-state-server",
        name: "Complex State Server",
        type: "stdio",
        command: "python",
        args: ["-m", "complex_server"],
        enabled: true
      };

      await act(async () => {
        await mcpClientManager.addServer(serverConfig);
      });

      act(() => {
        state.availableTools = [
          {
            name: "complex_tool",
            description: "Complex tool",
            inputSchema: { type: "object" },
            serverId: serverConfig.id,
            serverName: serverConfig.name
          }
        ];
        state.selectedServer = serverConfig.id;
      });

      // Navigate through all views systematically
      const allViews = [
        "Home",
        "Menu",
        "SelectModel",
        "Threads",
        "DiscoverMCP",
        "MCPMenu",
        "MCPTools",
        "ManageMCP"
      ];

      const { rerender } = render(React.createElement(Router));

      for (let i = 0; i < allViews.length; i++) {
        const view = allViews[i];

        act(() => {
          routerState.view = view as any;
        });

        rerender(React.createElement(Router));

        // Verify all state components persist correctly
        expect(routerState.view).toBe(view);
        expect(routerState.initialized).toBe(true);
        expect(modelsState.selectedModel).toBe("claude-3.5-sonnet");
        expect(threadsState.activeThreadId).toBe("complex-state-thread");
        expect(threadsState.message).toBe("Complex state message");
        const expectedResponse =
          i > Math.floor(allViews.length / 2)
            ? "Processing your request... Updated during navigation."
            : "Processing your request...";
        expect(threadsState.response).toBe(expectedResponse);
        expect(threadsState.streamingToolCalls).toHaveLength(1);
        expect(state.servers[serverConfig.id]).toBeDefined();
        expect(state.availableTools).toHaveLength(1);
        expect(state.selectedServer).toBe(serverConfig.id);

        // Make a small state change during navigation
        if (i === Math.floor(allViews.length / 2)) {
          act(() => {
            threadsState.response += " Updated during navigation.";
          });
        }
      }

      // Final verification that update persisted
      expect(threadsState.response).toBe(
        "Processing your request... Updated during navigation."
      );
    });
  });

  describe("Deep Navigation Scenarios", () => {
    it("should handle rapid navigation without state corruption", async () => {
      // Set up initial state
      act(() => {
        modelsState.selectedModel = "test-model";
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "rapid-nav-thread";
      });

      const views = ["Home", "Menu", "Threads", "MCPMenu", "SelectModel"];
      const { rerender } = render(React.createElement(Router));

      // Rapid navigation simulation
      for (let cycle = 0; cycle < 5; cycle++) {
        for (const view of views) {
          act(() => {
            routerState.view = view as any;
          });

          rerender(React.createElement(Router));

          // Verify state consistency after each navigation
          expect(modelsState.selectedModel).toBe("test-model");
          expect(threadsState.activeThreadId).toBe("rapid-nav-thread");
        }
      }

      // Final verification
      expect(routerState.view).toBe("SelectModel");
      expect(modelsState.selectedModel).toBe("test-model");
      expect(threadsState.activeThreadId).toBe("rapid-nav-thread");
    });

    it("should handle navigation with state updates during transitions", async () => {
      const { rerender } = render(React.createElement(Router));

      const navigationFlow = [
        {
          view: "Home",
          stateUpdate: () => {
            threadsState.active = Chat.empty();
            threadsState.activeThreadId = "transition-thread";
          }
        },
        {
          view: "SelectModel",
          stateUpdate: () => {
            modelsState.selectedModel = "transition-model";
          }
        },
        {
          view: "MCPMenu",
          stateUpdate: async () => {
            const config: McpServerConfig = {
              id: "transition-server",
              name: "Transition Server",
              type: "stdio",
              command: "echo",
              args: ["transition"],
              enabled: true
            };
            await mcpClientManager.addServer(config);
          }
        },
        {
          view: "Threads",
          stateUpdate: () => {
            threadsState.message = "Thread message during transition";
          }
        },
        {
          view: "Home",
          stateUpdate: () => {
            threadsState.turn = "assistant";
            threadsState.response = "Assistant response during transition";
          }
        }
      ];

      for (const step of navigationFlow) {
        // Navigate
        act(() => {
          routerState.view = step.view as any;
        });

        rerender(React.createElement(Router));

        // Apply state update
        if (step.stateUpdate.constructor.name === "AsyncFunction") {
          await act(step.stateUpdate);
        } else {
          act(step.stateUpdate);
        }

        // Verify navigation succeeded
        expect(routerState.view).toBe(step.view);
      }

      // Verify all state updates persisted
      expect(threadsState.activeThreadId).toBe("transition-thread");
      expect(modelsState.selectedModel).toBe("transition-model");
      expect(state.servers["transition-server"]).toBeDefined();
      expect(threadsState.message).toBe("Thread message during transition");
      expect(threadsState.response).toBe("Assistant response during transition");
    });
  });

  describe("Error Recovery During Navigation", () => {
    it("should recover from navigation errors gracefully", async () => {
      const { rerender } = render(React.createElement(Router));

      // Set up valid state
      act(() => {
        routerState.view = "Home";
        threadsState.activeThreadId = "error-recovery-thread";
        modelsState.selectedModel = "recovery-model";
      });

      // Try to navigate to invalid view
      act(() => {
        (routerState as any).view = "InvalidView";
      });

      // Should handle gracefully without crashing
      expect(() => {
        rerender(React.createElement(Router));
      }).not.toThrow();

      // State should remain intact
      expect(threadsState.activeThreadId).toBe("error-recovery-thread");
      expect(modelsState.selectedModel).toBe("recovery-model");

      // Should be able to recover by navigating to valid view
      act(() => {
        routerState.view = "Menu";
      });

      expect(() => {
        rerender(React.createElement(Router));
      }).not.toThrow();

      expect(routerState.view).toBe("Menu");
    });

    it("should handle state corruption during navigation", async () => {
      // Set up normal state
      act(() => {
        routerState.view = "Home";
        threadsState.activeThreadId = "corruption-test";
        modelsState.selectedModel = "test-model";
      });

      const { rerender } = render(React.createElement(Router));

      // Simulate state corruption
      act(() => {
        (threadsState as any).active = null;
        (threadsState as any).activeThreadId = null;
        routerState.view = "Threads";
      });

      // Should handle gracefully
      expect(() => {
        rerender(React.createElement(Router));
      }).not.toThrow();

      // Should be able to recover
      act(() => {
        threadsState.active = Chat.empty();
        threadsState.activeThreadId = "recovered-thread";
        routerState.view = "Home";
      });

      expect(() => {
        rerender(React.createElement(Router));
      }).not.toThrow();

      expect(threadsState.activeThreadId).toBe("recovered-thread");
      expect(routerState.view).toBe("Home");
    });
  });
});
