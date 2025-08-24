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
import { state as threadsState } from "@/threads/state/state.js";
import { state } from "@/mcp/state/state.js";
import { mcpClientManager } from "@/mcp/client/index.js";
import { Read } from "@/tools/Read.js";
import { Write } from "@/tools/Write.js";
import { Chat } from "@lmstudio/sdk";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { McpServerConfig, McpTool } from "@/mcp/types.js";

// Mock LMStudio SDK for controlled streaming behavior
const mockStreamingResponse = {
  *[Symbol.asyncIterator]() {
    yield { content: "I'll help you with that task." };
    yield {
      toolCalls: [
        {
          id: "call_read_file",
          type: "function" as const,
          function: {
            name: "Read",
            arguments: JSON.stringify({ file_path: "/test/sample.txt" })
          }
        }
      ]
    };
    yield { content: " Let me read the file first." };
    yield {
      toolCalls: [
        {
          id: "call_edit_file",
          type: "function" as const,
          function: {
            name: "Edit",
            arguments: JSON.stringify({
              file_path: "/test/sample.txt",
              old_string: "old content",
              new_string: "new content"
            })
          }
        }
      ]
    };
    yield { content: " The file has been updated successfully." };
  }
};

vi.mock("@lmstudio/sdk", async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    Chat: vi.fn().mockImplementation(() => ({
      respondStream: vi.fn().mockResolvedValue(mockStreamingResponse),
      getMessagesArray: vi.fn().mockReturnValue([]),
      addMessage: vi.fn(),
      lastMessage: null
    })),
    LMStudioClient: vi.fn().mockImplementation(() => ({
      llm: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null)
      }
    }))
  };
});

describe("Streaming Orchestration Integration Tests", () => {
  let tempDir: string;
  let testFile: string;
  let mockChatInstance: Chat;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `streaming-orchestration-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "sample.txt");

    // Initialize mock chat instance
    mockChatInstance = new Chat();
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset thread state
    threadsState.active = mockChatInstance;
    threadsState.activeThreadId = `test-thread-${Date.now()}`;
    threadsState.turn = "user";
    threadsState.message = "";
    threadsState.response = "";
    threadsState.streamingToolCalls = [];
    threadsState.refresh = 0;

    // Reset MCP state
    Object.keys(state.servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];
    state.lastUpdated = 0;

    // Create test file with initial content
    writeFileSync(testFile, "old content for testing");
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

    // Clean up test files
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
  });

  describe("MCP Tool Integration in Streaming", () => {
    it("should integrate MCP tools in streaming workflow", async () => {
      // Set up mock MCP server with tools
      const mockServerConfig: McpServerConfig = {
        id: "streaming-test-server",
        name: "Streaming Test Server",
        type: "stdio",
        command: "echo",
        args: ["mock server"],
        enabled: true
      };

      await mcpClientManager.addServer(mockServerConfig);

      // Mock MCP tools
      const mockMcpTool: McpTool = {
        name: "mcp_custom_operation",
        description: "Custom MCP operation for testing",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string" },
            data: { type: "string" }
          }
        },
        serverId: mockServerConfig.id,
        serverName: mockServerConfig.name
      };

      state.availableTools = [mockMcpTool];
      // Set tools in server capabilities
      if (!state.servers[mockServerConfig.id].capabilities) {
        state.servers[mockServerConfig.id].capabilities = {};
      }
      state.servers[mockServerConfig.id].capabilities.tools = [mockMcpTool as any];

      // Mock streaming with MCP tool calls
      const mcpStreamingResponse = {
        *[Symbol.asyncIterator]() {
          yield { content: "Using MCP tool..." };
          yield {
            toolCalls: [
              {
                id: "call_mcp_operation",
                type: "function" as const,
                function: {
                  name: "mcp_custom_operation",
                  arguments: JSON.stringify({
                    operation: "process",
                    data: "test data"
                  })
                }
              }
            ]
          };
          yield { content: " MCP operation completed." };
        }
      };

      threadsState.turn = "assistant";

      for await (const chunk of mcpStreamingResponse) {
        if (chunk.content) {
          threadsState.response += chunk.content;
        }

        if (chunk.toolCalls) {
          for (const toolCall of chunk.toolCalls) {
            const streamingToolCall = {
              id: threadsState.streamingToolCalls.length + 1,
              toolCallId: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              createdAt: Date.now()
            };

            threadsState.streamingToolCalls.push(streamingToolCall);

            // REFACTOR: Simulate MCP tool execution with the new response format.
            const mockResult = {
              success: true,
              message: `MCP operation '${JSON.parse(toolCall.function.arguments).operation}' completed with data: ${JSON.parse(toolCall.function.arguments).data}`
            };

            // Update tool call with mock result
            const toolCallIndex = threadsState.streamingToolCalls.findIndex(
              tc => tc.toolCallId === toolCall.id
            );
            if (toolCallIndex >= 0) {
              threadsState.streamingToolCalls[toolCallIndex].result = mockResult;
              // REFACTOR: Determine hasError based on the success flag.
              threadsState.streamingToolCalls[toolCallIndex].hasError =
                !mockResult.success;
            }
          }
        }
      }

      // Verify MCP tool integration
      expect(threadsState.streamingToolCalls).toHaveLength(1);
      expect(threadsState.streamingToolCalls[0].name).toBe("mcp_custom_operation");
      // REFACTOR: Update assertion to check the new result object structure.
      expect(threadsState.streamingToolCalls[0].result).toMatchObject({
        success: true,
        message: expect.stringContaining("MCP operation 'process' completed")
      });
      expect(threadsState.response).toContain("Using MCP tool");
      expect(threadsState.response).toContain("MCP operation completed");
    });

    it("should handle mixed built-in and MCP tools in single stream", async () => {
      // Set up MCP server
      const serverConfig: McpServerConfig = {
        id: "mixed-tools-server",
        name: "Mixed Tools Server",
        type: "stdio",
        command: "echo",
        args: ["mixed"],
        enabled: true
      };

      await mcpClientManager.addServer(serverConfig);

      const mcpTool: McpTool = {
        name: "mcp_data_processor",
        description: "MCP data processing tool",
        inputSchema: { type: "object" },
        serverId: serverConfig.id,
        serverName: serverConfig.name
      };

      state.availableTools = [mcpTool];

      // Create test file for built-in tools
      writeFileSync(testFile, "initial data");

      // Mock mixed streaming response
      const mixedStreamingResponse = {
        *[Symbol.asyncIterator]() {
          yield { content: "Processing with mixed tools..." };
          yield {
            toolCalls: [
              {
                id: "call_builtin_read",
                type: "function" as const,
                function: {
                  name: "Read",
                  arguments: JSON.stringify({ file_path: testFile })
                }
              }
            ]
          };
          yield { content: " Read complete, now processing..." };
          yield {
            toolCalls: [
              {
                id: "call_mcp_process",
                type: "function" as const,
                function: {
                  name: "mcp_data_processor",
                  arguments: JSON.stringify({ data: "initial data" })
                }
              }
            ]
          };
          yield { content: " Writing results..." };
          yield {
            toolCalls: [
              {
                id: "call_builtin_write",
                type: "function" as const,
                function: {
                  name: "Write",
                  arguments: JSON.stringify({
                    file_path: join(tempDir, "processed.txt"),
                    content: "processed data"
                  })
                }
              }
            ]
          };
          yield { content: " All operations completed." };
        }
      };

      threadsState.turn = "assistant";

      for await (const chunk of mixedStreamingResponse) {
        if (chunk.content) {
          threadsState.response += chunk.content;
        }

        if (chunk.toolCalls) {
          for (const toolCall of chunk.toolCalls) {
            const streamingToolCall = {
              id: threadsState.streamingToolCalls.length + 1,
              toolCallId: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              createdAt: Date.now()
            };

            threadsState.streamingToolCalls.push(streamingToolCall);

            // REFACTOR: Centralize result handling and hasError logic.
            let result;
            const args = JSON.parse(toolCall.function.arguments);

            // Handle built-in vs MCP tools
            switch (toolCall.function.name) {
              case "Read":
                result = await Read.implementation(args);
                break;
              case "Write":
                result = await Write.implementation(args);
                break;
              case "mcp_data_processor":
                // Mock MCP tool result in the new format
                result = { success: true, message: `Processed: ${args.data}` };
                break;
              default:
                result = { success: false, message: "Unknown tool" };
            }

            // Update tool call with result
            const toolCallIndex = threadsState.streamingToolCalls.findIndex(
              tc => tc.toolCallId === toolCall.id
            );
            if (toolCallIndex >= 0) {
              threadsState.streamingToolCalls[toolCallIndex].result = result;
              // Set hasError based on the tool's response
              threadsState.streamingToolCalls[toolCallIndex].hasError =
                !result.success;
            }
          }
        }
      }

      // Verify mixed tool execution
      expect(threadsState.streamingToolCalls).toHaveLength(3);

      const toolNames = threadsState.streamingToolCalls.map(tc => tc.name);
      expect(toolNames).toEqual(["Read", "mcp_data_processor", "Write"]);

      // Verify all tools executed successfully
      threadsState.streamingToolCalls.forEach(toolCall => {
        expect(toolCall.hasError).toBe(false);
        expect(toolCall.result).toBeDefined();
        // You can also assert the success property directly for clarity
        expect(toolCall.result.success).toBe(true);
      });

      // Verify file operations completed
      expect(existsSync(join(tempDir, "processed.txt"))).toBe(true);
      const processedContent = readFileSync(join(tempDir, "processed.txt"), "utf8");
      expect(processedContent).toBe("processed data");
    });
  });

  describe("Tool Chain Error Recovery", () => {
    it("should recover from tool chain failures and continue streaming", async () => {
      const failureRecoveryResponse = {
        *[Symbol.asyncIterator]() {
          yield { content: "Starting complex operation..." };
          yield {
            toolCalls: [
              {
                id: "call_failing_read",
                type: "function" as const,
                function: {
                  name: "Read",
                  arguments: JSON.stringify({ file_path: "/nonexistent/fail.txt" })
                }
              }
            ]
          };
          yield { content: " First step failed, trying alternative..." };
          yield {
            toolCalls: [
              {
                id: "call_recovery_write",
                type: "function" as const,
                function: {
                  name: "Write",
                  arguments: JSON.stringify({
                    file_path: testFile,
                    content: "recovered content"
                  })
                }
              }
            ]
          };
          yield { content: " Recovery successful, continuing..." };
          yield {
            toolCalls: [
              {
                id: "call_verify_read",
                type: "function" as const,
                function: {
                  name: "Read",
                  arguments: JSON.stringify({ file_path: testFile })
                }
              }
            ]
          };
          yield { content: " Verification complete. Task finished." };
        }
      };

      threadsState.turn = "assistant";

      const toolExecutionLog: string[] = [];

      for await (const chunk of failureRecoveryResponse) {
        if (chunk.content) {
          threadsState.response += chunk.content;
        }

        if (chunk.toolCalls) {
          for (const toolCall of chunk.toolCalls) {
            const streamingToolCall = {
              id: threadsState.streamingToolCalls.length + 1,
              toolCallId: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              createdAt: Date.now()
            };

            threadsState.streamingToolCalls.push(streamingToolCall);
            toolExecutionLog.push(toolCall.function.name);

            // REFACTOR: Simplified result and error handling. Assumes tools
            // no longer throw for expected failures but return { success: false }.
            const args = JSON.parse(toolCall.function.arguments);
            let result;
            try {
              switch (toolCall.function.name) {
                case "Read":
                  result = await Read.implementation(args);
                  break;
                case "Write":
                  result = await Write.implementation(args);
                  break;
                default:
                  result = { success: false, message: "Unknown tool" };
              }
            } catch (error) {
              // Catch unexpected errors and format them consistently.
              result = { success: false, message: (error as Error).message };
            }

            const hasError = !result.success;

            // Update tool call with result
            const toolCallIndex = threadsState.streamingToolCalls.findIndex(
              tc => tc.toolCallId === toolCall.id
            );
            if (toolCallIndex >= 0) {
              threadsState.streamingToolCalls[toolCallIndex].result = result;
              threadsState.streamingToolCalls[toolCallIndex].hasError = hasError;
            }
          }
        }
      }

      // Verify tool execution order and results
      expect(toolExecutionLog).toEqual(["Read", "Write", "Read"]);
      expect(threadsState.streamingToolCalls).toHaveLength(3);

      // Verify first tool failed
      expect(threadsState.streamingToolCalls[0].hasError).toBe(true);
      expect(threadsState.streamingToolCalls[0].name).toBe("Read");
      expect(threadsState.streamingToolCalls[0].result.success).toBe(false);

      // Verify recovery tool succeeded
      expect(threadsState.streamingToolCalls[1].hasError).toBe(false);
      expect(threadsState.streamingToolCalls[1].name).toBe("Write");
      expect(threadsState.streamingToolCalls[1].result.success).toBe(true);

      // Verify verification tool succeeded
      expect(threadsState.streamingToolCalls[2].hasError).toBe(false);
      expect(threadsState.streamingToolCalls[2].name).toBe("Read");
      expect(threadsState.streamingToolCalls[2].result.success).toBe(true);
      // REFACTOR: The content is in the `message` property of the `result` object.
      expect(threadsState.streamingToolCalls[2].result.message).toBe(
        "recovered content"
      );

      // Verify streaming continued throughout
      expect(threadsState.response).toContain("Starting complex operation");
      expect(threadsState.response).toContain(
        "First step failed, trying alternative"
      );
      expect(threadsState.response).toContain("Recovery successful");
      expect(threadsState.response).toContain("Task finished");
    });
  });

  describe("Performance and Timing", () => {
    it("should handle rapid tool call sequences without state corruption", async () => {
      const rapidToolCalls = Array.from({ length: 20 }, (_, i) => ({
        id: `call_rapid_${i}`,
        type: "function" as const,
        function: {
          name: "Write",
          arguments: JSON.stringify({
            file_path: join(tempDir, `rapid_${i}.txt`),
            content: `Content for file ${i}`
          })
        }
      }));

      threadsState.turn = "assistant";

      const startTime = Date.now();

      // Execute rapid tool calls
      const promises = rapidToolCalls.map(async (toolCall, index) => {
        const streamingToolCall = {
          id: index + 1,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          createdAt: Date.now()
        };

        // Note: In a real scenario, state updates in parallel like this can be risky.
        // For this test, since we find the index later, it's mostly safe.
        threadsState.streamingToolCalls.push(streamingToolCall);

        const args = JSON.parse(toolCall.function.arguments);
        const result = await Write.implementation(args);

        // Update tool call with result
        const toolCallIndex = threadsState.streamingToolCalls.findIndex(
          tc => tc.toolCallId === toolCall.id
        );
        if (toolCallIndex >= 0) {
          threadsState.streamingToolCalls[toolCallIndex].result = result;
          // REFACTOR: Dynamically set hasError based on the result.
          threadsState.streamingToolCalls[toolCallIndex].hasError = !result.success;
        }

        return result;
      });

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Verify all tool calls completed
      expect(threadsState.streamingToolCalls).toHaveLength(20);

      // Verify no state corruption
      const uniqueIds = new Set(
        threadsState.streamingToolCalls.map(tc => tc.toolCallId)
      );
      expect(uniqueIds.size).toBe(20);

      // All calls should have succeeded
      threadsState.streamingToolCalls.forEach(tc => {
        expect(tc.hasError).toBe(false);
      });

      // Verify all files were created
      for (let i = 0; i < 20; i++) {
        expect(existsSync(join(tempDir, `rapid_${i}.txt`))).toBe(true);
      }

      // Performance check (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});
