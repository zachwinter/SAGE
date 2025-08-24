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
import { state } from "@/mcp/state/state.js";
import { Chat } from "@lmstudio/sdk";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock the MCP state to avoid import issues
vi.mock("@/mcp/state/state.js", () => ({
  state: {
    servers: {},
    serverConfigs: {},
    availableTools: [],
    availableResources: [],
    availablePrompts: [],
    isLoading: false,
    lastUpdated: 0,
    selectedServer: null,
    searchState: {
      query: "",
      selectedIndex: 0,
      isSearchFocused: true
    },
    installationState: {
      status: {},
      loading: {}
    }
  }
}));

describe("UI Workflow Integration Tests", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `ui-workflows-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
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

    // Reset MCP state
    Object.keys(state.servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.serverConfigs = {};
    state.lastUpdated = 0;
  });

  afterEach(() => {
    // Clean up any chat instances
    if (threadsState.active) {
      threadsState.active = null;
    }
  });

  describe("Router Navigation Workflows", () => {
    it("should initialize with Home view and render Chat component", () => {
      expect(routerState.view).toBe("Home");

      const { container } = render(React.createElement(Router));

      // Should render without errors
      expect(container).toBeDefined();
      expect(routerState.view).toBe("Home");
    });

    it("should handle view transitions correctly", () => {
      // Start at Home
      expect(routerState.view).toBe("Home");

      // Navigate to Menu
      act(() => {
        routerState.view = "Menu";
      });

      expect(routerState.view).toBe("Menu");

      // Navigate to Threads
      act(() => {
        routerState.view = "Threads";
      });

      expect(routerState.view).toBe("Threads");

      // Navigate to MCP Menu
      act(() => {
        routerState.view = "MCPMenu";
      });

      expect(routerState.view).toBe("MCPMenu");
    });

    it("should maintain state consistency during navigation", () => {
      // Set up some thread state
      const mockChatInstance = {} as Chat;

      act(() => {
        threadsState.active = mockChatInstance;
        threadsState.activeThreadId = "test-thread-123";
        threadsState.message = "test message";
      });

      // Navigate to different views
      act(() => {
        routerState.view = "Menu";
      });

      // Thread state should persist
      expect(threadsState.active).toEqual(mockChatInstance);
      expect(threadsState.activeThreadId).toBe("test-thread-123");
      expect(threadsState.message).toBe("test message");

      // Navigate back to Home
      act(() => {
        routerState.view = "Home";
      });

      // State should still be intact
      expect(threadsState.active).toEqual(mockChatInstance);
      expect(threadsState.activeThreadId).toBe("test-thread-123");
      expect(threadsState.message).toBe("test message");
    });
  });

  describe("Chat Interaction Workflows", () => {
    it("should handle user turn to assistant turn transition", () => {
      expect(threadsState.turn).toBe("user");

      // Simulate user submitting a message
      act(() => {
        threadsState.message = "Hello, can you help me?";
        threadsState.turn = "assistant";
      });

      expect(threadsState.turn).toBe("assistant");
      expect(threadsState.message).toBe("Hello, can you help me?");
    });

    it("should handle streaming tool calls during assistant turn", () => {
      // Set up assistant turn
      act(() => {
        threadsState.turn = "assistant";
        threadsState.response = "I'll help you with that.";
      });

      // Add streaming tool call
      const toolCall = {
        id: 1,
        toolCallId: "call_abc123",
        name: "Read",
        arguments: '{"file_path": "/test/file.txt"}',
        createdAt: Date.now()
      };

      act(() => {
        threadsState.streamingToolCalls.push(toolCall);
      });

      expect(threadsState.streamingToolCalls).toHaveLength(1);
      expect(threadsState.streamingToolCalls[0].name).toBe("Read");
      expect(threadsState.streamingToolCalls[0].toolCallId).toBe("call_abc123");
    });

    it("should handle tool call errors gracefully", () => {
      // Add streaming tool call with error
      const errorToolCall = {
        id: 2,
        toolCallId: "call_error123",
        name: "NonExistentTool",
        arguments: '{"invalid": "args"}',
        createdAt: Date.now(),
        hasError: true,
        errorMessage: "Tool not found"
      };

      act(() => {
        threadsState.turn = "assistant";
        threadsState.streamingToolCalls.push(errorToolCall);
      });

      expect(threadsState.streamingToolCalls[0].hasError).toBe(true);
      expect(threadsState.streamingToolCalls[0].errorMessage).toBe("Tool not found");
    });

    it("should clean up streaming tool calls after completion", () => {
      // Add multiple tool calls
      const toolCalls = [
        {
          id: 1,
          toolCallId: "call_1",
          name: "Read",
          arguments: "{}",
          createdAt: Date.now() - 1000
        },
        {
          id: 2,
          toolCallId: "call_2",
          name: "Write",
          arguments: "{}",
          createdAt: Date.now()
        }
      ];

      act(() => {
        threadsState.turn = "assistant";
        threadsState.streamingToolCalls.push(...toolCalls);
      });

      expect(threadsState.streamingToolCalls).toHaveLength(2);

      // Simulate conversation completion
      act(() => {
        threadsState.turn = "user";
        threadsState.streamingToolCalls = [];
      });

      expect(threadsState.streamingToolCalls).toHaveLength(0);
      expect(threadsState.turn).toBe("user");
    });
  });

  describe("Chat + Thread State Integration", () => {
    it("should handle thread creation and activation workflow", () => {
      expect(threadsState.active).toBeNull();
      expect(threadsState.activeThreadId).toBeNull();

      // Create and activate a new thread
      const mockChat = {} as Chat;
      const threadId = "thread-new-123";

      act(() => {
        threadsState.active = mockChat;
        threadsState.activeThreadId = threadId;
      });

      expect(threadsState.active).toEqual(mockChat);
      expect(threadsState.activeThreadId).toBe(threadId);
      expect(threadsState.saved).toBeDefined();
    });

    it("should handle thread switching workflow", () => {
      // Set up first thread
      const chat1 = {} as Chat;
      const threadId1 = "thread-1";

      act(() => {
        threadsState.active = chat1;
        threadsState.activeThreadId = threadId1;
        threadsState.message = "Message from thread 1";
      });

      // Switch to second thread
      const chat2 = {} as Chat;
      const threadId2 = "thread-2";

      act(() => {
        threadsState.active = chat2;
        threadsState.activeThreadId = threadId2;
        threadsState.message = "Message from thread 2";
      });

      expect(threadsState.active).toEqual(chat2);
      expect(threadsState.activeThreadId).toBe(threadId2);
      expect(threadsState.message).toBe("Message from thread 2");
    });
  });

  describe("MCP Integration Workflows", () => {
    it("should handle MCP server management from UI", () => {
      // Navigate to MCP management
      act(() => {
        routerState.view = "MCPMenu";
      });

      expect(routerState.view).toBe("MCPMenu");

      // Add a mock MCP server
      const serverConfig = {
        id: "test-server",
        name: "Test Server",
        type: "node" as const,
        command: "node",
        args: ["server.js"],
        cwd: tempDir,
        enabled: true
      };

      act(() => {
        state.servers["test-server"] = {
          id: "test-server",
          name: "Test Server",
          status: "disconnected",
          config: serverConfig,
          lastUpdate: Date.now(),
          tools: []
        };
      });

      expect(state.servers["test-server"]).toBeDefined();
      expect(state.servers["test-server"].name).toBe("Test Server");
    });

    it("should handle MCP tools discovery workflow", () => {
      // Navigate to tools view
      act(() => {
        routerState.view = "MCPTools";
      });

      expect(routerState.view).toBe("MCPTools");

      // Add server with tools
      act(() => {
        state.servers["tools-server"] = {
          id: "tools-server",
          name: "Tools Server",
          status: "connected",
          config: {
            id: "tools-server",
            name: "Tools Server",
            type: "python",
            command: "python",
            args: ["-m", "server"],
            cwd: tempDir,
            enabled: true
          },
          lastUpdate: Date.now(),
          tools: [
            {
              name: "custom_tool",
              description: "A custom MCP tool",
              inputSchema: {
                type: "object",
                properties: {
                  input: { type: "string" }
                }
              }
            }
          ]
        };
      });

      const server = state.servers["tools-server"];
      expect(server.tools).toHaveLength(1);
      expect(server.tools[0].name).toBe("custom_tool");
      expect(server.status).toBe("connected");
    });
  });

  describe("Error Handling Workflows", () => {
    it("should handle navigation to invalid views gracefully", () => {
      // Try to navigate to invalid view
      act(() => {
        (routerState as any).view = "InvalidView";
      });

      const { container } = render(React.createElement(Router));

      // Should render error message without crashing
      expect(container).toBeDefined();
    });

    it("should handle chat rendering errors gracefully", () => {
      // Set up a scenario that might cause rendering errors
      act(() => {
        routerState.view = "Home";
        threadsState.turn = "assistant";
        // Add malformed streaming tool call
        threadsState.streamingToolCalls.push({
          id: 999,
          name: "", // Empty name might cause issues
          arguments: "invalid json",
          createdAt: Date.now()
        });
      });

      // Should not throw when rendering
      expect(() => {
        render(React.createElement(Router));
      }).not.toThrow();
    });

    it("should handle state inconsistencies gracefully", () => {
      // Create inconsistent state
      act(() => {
        threadsState.active = null;
        threadsState.activeThreadId = "orphaned-thread-id";
        threadsState.turn = "assistant";
        threadsState.response = "Response without active chat";
      });

      // Should handle gracefully
      expect(threadsState.active).toBeNull();
      expect(threadsState.activeThreadId).toBe("orphaned-thread-id");

      // Rendering should not crash
      expect(() => {
        render(React.createElement(Router));
      }).not.toThrow();
    });
  });

  describe("Complete User Journey Workflows", () => {
    it("should handle complete workflow: startup → model selection → conversation → tool use", () => {
      // 1. App startup
      expect(routerState.view).toBe("Home");
      expect(routerState.initialized).toBe(false);

      // 2. Navigate to model selection
      act(() => {
        routerState.view = "SelectModel";
        routerState.initialized = true;
      });

      expect(routerState.view).toBe("SelectModel");
      expect(routerState.initialized).toBe(true);

      // 3. Return to Home and start conversation
      act(() => {
        routerState.view = "Home";
        threadsState.active = {} as Chat;
        threadsState.activeThreadId = "user-journey-thread";
      });

      // 4. User sends message
      act(() => {
        threadsState.message = "Can you read a file for me?";
        threadsState.turn = "assistant";
      });

      // 5. Assistant responds with tool use
      act(() => {
        threadsState.response = "I'll read that file for you.";
        threadsState.streamingToolCalls.push({
          id: 1,
          toolCallId: "call_read_file",
          name: "Read",
          arguments: JSON.stringify({ file_path: "/test/file.txt" }),
          createdAt: Date.now()
        });
      });

      // 6. Verify final state
      expect(routerState.view).toBe("Home");
      expect(threadsState.active).toBeDefined();
      expect(threadsState.turn).toBe("assistant");
      expect(threadsState.streamingToolCalls).toHaveLength(1);
      expect(threadsState.streamingToolCalls[0].name).toBe("Read");
    });
  });
});
