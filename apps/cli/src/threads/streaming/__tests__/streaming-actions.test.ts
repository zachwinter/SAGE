import { Logger } from "@sage/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../../state/state.js";
import {
  addStreamingToolCall,
  appendToStreamingToolCallArgs,
  clearAllStreamingToolCalls,
  flushFragmentBuffer,
  removeCompletedStreamingToolCalls,
  updateStreamingToolCallName
} from "../actions.js";

const logger = new Logger("Streaming Actions Test");

beforeEach(() => {
  clearAllStreamingToolCalls();
  state.streamingToolCalls = [];
  vi.spyOn(logger, "debug").mockImplementation(() => {});
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  clearAllStreamingToolCalls();
});

describe("Streaming Tool Call Actions", () => {
  describe("addStreamingToolCall", () => {
    it("should add a new streaming tool call", () => {
      const callId = 1;
      const info = { toolCallId: "test-tool-123" };

      addStreamingToolCall(callId, info);

      expect(state.streamingToolCalls).toHaveLength(1);
      expect(state.streamingToolCalls[0]).toMatchObject({
        id: callId,
        toolCallId: info.toolCallId,
        name: "",
        arguments: "",
        hasError: false
      });
    });

    it("should not add duplicate streaming tool calls", () => {
      const callId = 1;
      const info = { toolCallId: "test-tool-123" };

      addStreamingToolCall(callId, info);
      addStreamingToolCall(callId, info); // Duplicate

      expect(state.streamingToolCalls).toHaveLength(1);
    });
  });

  describe("updateStreamingToolCallName", () => {
    it("should update tool call name", () => {
      const callId = 1;
      addStreamingToolCall(callId, { toolCallId: "test-tool-123" });

      updateStreamingToolCallName(callId, "Write");

      expect(state.streamingToolCalls[0].name).toBe("Write");
    });

    it("should handle missing tool call gracefully", () => {
      updateStreamingToolCallName(999, "Write");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Tool call not found for name update, callId: 999")
      );
    });
  });

  describe("appendToStreamingToolCallArgs", () => {
    beforeEach(() => {
      const callId = 1;
      addStreamingToolCall(callId, { toolCallId: "test-tool-123" });
      updateStreamingToolCallName(callId, "Write");
    });

    it("should handle empty fragments", () => {
      appendToStreamingToolCallArgs(1, "");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Empty fragment received for callId: 1")
      );
    });

    it("should accumulate fragments in buffer", async () => {
      appendToStreamingToolCallArgs(1, "fragment1");
      appendToStreamingToolCallArgs(1, "fragment2");

      // Wait for debounced flush
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(state.streamingToolCalls[0].arguments).toBe("fragment1fragment2");
    });

    it("should handle rapid fragments without race conditions", async () => {
      const callId = 1;
      const fragments = Array.from({ length: 10 }, (_, i) => `fragment${i}`);

      // Send fragments rapidly
      fragments.forEach(fragment => {
        appendToStreamingToolCallArgs(callId, fragment);
      });

      // Wait for all flushes to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const expectedContent = fragments.join("");
      expect(state.streamingToolCalls[0].arguments).toBe(expectedContent);
    });

    it("should handle invalid call IDs gracefully", () => {
      const invalidCallId = -1;

      // This should not throw but log debug information
      appendToStreamingToolCallArgs(invalidCallId, "test");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Fragment appended to callId: ${invalidCallId}`)
      );
    });
  });

  describe("flushFragmentBuffer", () => {
    it("should flush buffer contents to tool call arguments", async () => {
      const callId = 1;
      addStreamingToolCall(callId, { toolCallId: "test-tool-123" });
      updateStreamingToolCallName(callId, "Write");

      // Add some content to arguments first
      state.streamingToolCalls[0].arguments = "existing";

      appendToStreamingToolCallArgs(callId, "newcontent");

      // Manually flush
      await flushFragmentBuffer(callId);

      expect(state.streamingToolCalls[0].arguments).toBe("existingnewcontent");
    });

    it("should handle concurrent flush attempts", async () => {
      const callId = 1;
      addStreamingToolCall(callId, { toolCallId: "test-tool-123" });
      updateStreamingToolCallName(callId, "Write");

      appendToStreamingToolCallArgs(callId, "content");

      // Start multiple flushes concurrently
      const flushPromise1 = flushFragmentBuffer(callId);
      const flushPromise2 = flushFragmentBuffer(callId);
      const flushPromise3 = flushFragmentBuffer(callId);

      // They should all return the same promise
      expect(flushPromise1).toBe(flushPromise2);
      expect(flushPromise2).toBe(flushPromise3);

      await Promise.all([flushPromise1, flushPromise2, flushPromise3]);

      expect(state.streamingToolCalls[0].arguments).toBe("content");
    });
  });

  describe("removeCompletedStreamingToolCalls", () => {
    it("should flush buffers before removing completed tool calls", async () => {
      const callId1 = 1;
      const callId2 = 2;

      addStreamingToolCall(callId1, { toolCallId: "completed-tool" });
      addStreamingToolCall(callId2, { toolCallId: "ongoing-tool" });

      updateStreamingToolCallName(callId1, "Write");
      updateStreamingToolCallName(callId2, "Read");

      // Add fragments to both
      appendToStreamingToolCallArgs(callId1, "content1");
      appendToStreamingToolCallArgs(callId2, "content2");

      const completedIds = new Set(["completed-tool"]);
      await removeCompletedStreamingToolCalls(completedIds);

      // Only ongoing tool should remain
      expect(state.streamingToolCalls).toHaveLength(1);
      expect(state.streamingToolCalls[0].toolCallId).toBe("ongoing-tool");

      // Wait for any remaining debounced flushes
      await new Promise(resolve => setTimeout(resolve, 20));

      // Ongoing tool should have its content
      expect(state.streamingToolCalls[0].arguments).toBe("content2");
    });

    it("should handle missing tool calls during completion", async () => {
      const completedIds = new Set(["non-existent-tool"]);

      // Should not throw
      await expect(
        removeCompletedStreamingToolCalls(completedIds)
      ).resolves.toBeUndefined();
    });
  });

  describe("Race condition scenarios", () => {
    it("should handle timeout clearing during active flush", async () => {
      const callId = 1;
      addStreamingToolCall(callId, { toolCallId: "test-tool-123" });
      updateStreamingToolCallName(callId, "Write");

      // Add fragment to trigger timeout
      appendToStreamingToolCallArgs(callId, "content1");

      // Add another fragment quickly (should clear previous timeout)
      appendToStreamingToolCallArgs(callId, "content2");

      // Wait for flushes
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(state.streamingToolCalls[0].arguments).toBe("content1content2");
    });

    it("should handle completion during active streaming", async () => {
      const callId = 1;
      const toolCallId = "racing-tool";

      addStreamingToolCall(callId, { toolCallId });
      updateStreamingToolCallName(callId, "Write");

      // Start streaming content
      appendToStreamingToolCallArgs(callId, "streaming");

      // Simulate completion happening during streaming
      const completedIds = new Set([toolCallId]);

      // This should flush and then remove
      await removeCompletedStreamingToolCalls(completedIds);

      expect(state.streamingToolCalls).toHaveLength(0);
    });
  });
});
