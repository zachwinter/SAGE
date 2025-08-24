import { describe, it, expect, beforeEach, vi } from "vitest";
import { getToolRequestMap } from "../selectors.js";
import type { ThreadsState } from "../state.js";
import type { ToolCallRequest } from "@lmstudio/sdk";

describe("threads state selectors", () => {
  describe("getToolRequestMap", () => {
    it("should return empty map when there is no active thread", () => {
      const snap: ThreadsState = {
        active: null,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("should return empty map when active thread has no messages", () => {
      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockActive.getMessagesArray).toHaveBeenCalledTimes(1);
    });

    it("should extract tool call requests from messages", () => {
      const mockToolRequest1: ToolCallRequest = {
        id: "tool-call-1",
        name: "read_file",
        arguments: { path: "/test/file.txt" }
      };

      const mockToolRequest2: ToolCallRequest = {
        id: "tool-call-2",
        name: "write_file",
        arguments: { path: "/test/output.txt", content: "test content" }
      };

      const mockMessage1 = {
        getToolCallRequests: vi.fn().mockReturnValue([mockToolRequest1])
      };

      const mockMessage2 = {
        getToolCallRequests: vi.fn().mockReturnValue([mockToolRequest2])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage1, mockMessage2])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      expect(result.size).toBe(2);
      expect(result.get("tool-call-1")).toEqual(mockToolRequest1);
      expect(result.get("tool-call-2")).toEqual(mockToolRequest2);
      expect(mockActive.getMessagesArray).toHaveBeenCalledTimes(1);
      expect(mockMessage1.getToolCallRequests).toHaveBeenCalledTimes(1);
      expect(mockMessage2.getToolCallRequests).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple tool requests in a single message", () => {
      const mockToolRequest1: ToolCallRequest = {
        id: "tool-call-1",
        name: "read_file",
        arguments: { path: "/test1.txt" }
      };

      const mockToolRequest2: ToolCallRequest = {
        id: "tool-call-2",
        name: "read_file",
        arguments: { path: "/test2.txt" }
      };

      const mockMessage = {
        getToolCallRequests: vi
          .fn()
          .mockReturnValue([mockToolRequest1, mockToolRequest2])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      expect(result.size).toBe(2);
      expect(result.get("tool-call-1")).toEqual(mockToolRequest1);
      expect(result.get("tool-call-2")).toEqual(mockToolRequest2);
    });

    it("should skip tool requests without id", () => {
      const mockValidRequest: ToolCallRequest = {
        id: "valid-id",
        name: "read_file",
        arguments: { path: "/test.txt" }
      };

      const mockInvalidRequest = {
        // Missing id field
        name: "write_file",
        arguments: { path: "/test.txt" }
      } as ToolCallRequest;

      const mockMessage = {
        getToolCallRequests: vi
          .fn()
          .mockReturnValue([mockValidRequest, mockInvalidRequest])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      expect(result.size).toBe(1);
      expect(result.get("valid-id")).toEqual(mockValidRequest);
    });

    it("should handle messages without tool call requests", () => {
      const mockMessage1 = {
        getToolCallRequests: vi.fn().mockReturnValue([])
      };

      const mockMessage2 = {
        getToolCallRequests: vi.fn().mockReturnValue(null)
      };

      const mockMessage3 = {
        getToolCallRequests: vi.fn().mockReturnValue(undefined)
      };

      const mockActive = {
        getMessagesArray: vi
          .fn()
          .mockReturnValue([mockMessage1, mockMessage2, mockMessage3])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      expect(result.size).toBe(0);
      expect(mockMessage1.getToolCallRequests).toHaveBeenCalledTimes(1);
      expect(mockMessage2.getToolCallRequests).toHaveBeenCalledTimes(1);
      expect(mockMessage3.getToolCallRequests).toHaveBeenCalledTimes(1);
    });

    it("should handle errors when accessing tool call requests gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockMessage1 = {
        getToolCallRequests: vi.fn().mockImplementation(() => {
          throw new Error("Failed to get tool call requests");
        })
      };

      const mockValidRequest: ToolCallRequest = {
        id: "valid-id",
        name: "read_file",
        arguments: { path: "/test.txt" }
      };

      const mockMessage2 = {
        getToolCallRequests: vi.fn().mockReturnValue([mockValidRequest])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage1, mockMessage2])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      // Should skip errored message but process valid ones
      expect(result.size).toBe(1);
      expect(result.get("valid-id")).toEqual(mockValidRequest);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get tool call requests from message:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle malformed active thread gracefully", () => {
      const snap1: ThreadsState = {
        active: "not-an-object" as any,
        history: [],
        settings: {}
      };

      const result1 = getToolRequestMap(snap1 as Readonly<ThreadsState>);
      expect(result1.size).toBe(0);

      const snap2: ThreadsState = {
        active: {} as any, // Object without getMessagesArray method
        history: [],
        settings: {}
      };

      const result2 = getToolRequestMap(snap2 as Readonly<ThreadsState>);
      expect(result2.size).toBe(0);

      const snap3: ThreadsState = {
        active: { getMessagesArray: "not-a-function" } as any,
        history: [],
        settings: {}
      };

      const result3 = getToolRequestMap(snap3 as Readonly<ThreadsState>);
      expect(result3.size).toBe(0);
    });

    it("should be memoized for identical snapshots", () => {
      const mockToolRequest: ToolCallRequest = {
        id: "tool-call-1",
        name: "read_file",
        arguments: { path: "/test.txt" }
      };

      const mockMessage = {
        getToolCallRequests: vi.fn().mockReturnValue([mockToolRequest])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage])
      };

      const snap: Readonly<ThreadsState> = {
        active: mockActive,
        history: [],
        settings: {}
      };

      // Call twice with the same snapshot
      const result1 = getToolRequestMap(snap);
      const result2 = getToolRequestMap(snap);

      // Results should be identical (memoized)
      expect(result1).toBe(result2);
      expect(result1.size).toBe(1);
      expect(result1.get("tool-call-1")).toEqual(mockToolRequest);
    });

    it("should handle duplicate tool call request IDs by using the last one", () => {
      const mockToolRequest1: ToolCallRequest = {
        id: "duplicate-id",
        name: "read_file",
        arguments: { path: "/first.txt" }
      };

      const mockToolRequest2: ToolCallRequest = {
        id: "duplicate-id", // Same ID
        name: "write_file",
        arguments: { path: "/second.txt", content: "content" }
      };

      const mockMessage = {
        getToolCallRequests: vi
          .fn()
          .mockReturnValue([mockToolRequest1, mockToolRequest2])
      };

      const mockActive = {
        getMessagesArray: vi.fn().mockReturnValue([mockMessage])
      };

      const snap: ThreadsState = {
        active: mockActive,
        history: [],
        settings: {}
      };

      const result = getToolRequestMap(snap as Readonly<ThreadsState>);

      expect(result.size).toBe(1);
      // Should have the last request with the duplicate ID
      expect(result.get("duplicate-id")).toEqual(mockToolRequest2);
    });
  });
});
