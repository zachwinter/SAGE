// src/stream-utils.test.ts
// Tests for streaming utilities

import { describe, it, expect } from "vitest";
import { AsyncQueue, mergeStreams, mapStream, filterStream, withErrorBoundary, withTimeout, bufferStream } from "./stream-utils.js";

describe("stream-utils", () => {
  describe("AsyncQueue", () => {
    it("should queue and emit values in order", async () => {
      const queue = new AsyncQueue<string>();
      
      queue.push("first");
      queue.push("second");
      queue.finish();
      
      const results = [];
      for await (const value of queue) {
        results.push(value);
      }
      
      expect(results).toEqual(["first", "second"]);
    });
    
    it("should handle values pushed after iteration starts", async () => {
      const queue = new AsyncQueue<string>();
      
      // Start iteration in a separate promise
      const iterationPromise = (async () => {
        const results = [];
        for await (const value of queue) {
          results.push(value);
        }
        return results;
      })();
      
      // Push values after iteration starts
      queue.push("first");
      queue.push("second");
      queue.finish();
      
      const results = await iterationPromise;
      expect(results).toEqual(["first", "second"]);
    });
    
    it("should handle early return", async () => {
      const queue = new AsyncQueue<string>();
      
      queue.push("first");
      queue.push("second");
      // Note: not calling finish()
      
      const results = [];
      for await (const value of queue) {
        results.push(value);
        if (value === "first") {
          break; // Early return
        }
      }
      
      expect(results).toEqual(["first"]);
    });
    
    it("should handle errors", async () => {
      const queue = new AsyncQueue<string>();
      
      queue.push("first");
      queue.fail(new Error("Test error"));
      
      await expect(async () => {
        const results = [];
        for await (const value of queue) {
          results.push(value);
        }
      }).rejects.toThrow("Test error");
    });

    it("should handle backpressure with buffer limits", () => {
      const queue = new AsyncQueue<string>(2);
      
      expect(queue.push("first")).toBe(true);
      expect(queue.push("second")).toBe(true);
      expect(queue.push("third")).toBe(false); // Should signal backpressure
      
      const stats = queue.getStats();
      expect(stats.queueLength).toBe(2);
      expect(stats.droppedItems).toBe(1);
      expect(stats.maxBufferSize).toBe(2);
    });

    it("should detect backpressure conditions", () => {
      const queue = new AsyncQueue<string>(10);
      
      // Fill to 80% threshold
      for (let i = 0; i < 8; i++) {
        queue.push(`item-${i}`);
      }
      
      expect(queue.isBackpressured()).toBe(true);
      
      // Under threshold should not be backpressured
      const smallQueue = new AsyncQueue<string>(10);
      smallQueue.push("item");
      expect(smallQueue.isBackpressured()).toBe(false);
    });
  });
  
  describe("mergeStreams", () => {
    it("should merge multiple streams", async () => {
      async function* stream1() {
        yield "a";
        yield "b";
      }
      
      async function* stream2() {
        yield "1";
        yield "2";
      }
      
      const merged = mergeStreams(stream1(), stream2());
      const results = [];
      for await (const value of merged) {
        results.push(value);
      }
      
      // Should contain all values, but order is not guaranteed
      expect(results).toHaveLength(4);
      expect(results).toContain("a");
      expect(results).toContain("b");
      expect(results).toContain("1");
      expect(results).toContain("2");
    });
    
    it("should handle empty streams", async () => {
      async function* emptyStream() {
        // No yields
      }
      
      async function* streamWithValues() {
        yield "a";
        yield "b";
      }
      
      const merged = mergeStreams(emptyStream(), streamWithValues());
      const results = [];
      for await (const value of merged) {
        results.push(value);
      }
      
      expect(results).toEqual(["a", "b"]);
    });
  });
  
  describe("mapStream", () => {
    it("should transform stream values", async () => {
      async function* source() {
        yield 1;
        yield 2;
        yield 3;
      }
      
      const mapped = mapStream(source(), x => x * 2);
      const results = [];
      for await (const value of mapped) {
        results.push(value);
      }
      
      expect(results).toEqual([2, 4, 6]);
    });
    
    it("should handle async mapping functions", async () => {
      async function* source() {
        yield 1;
        yield 2;
      }
      
      const mapped = mapStream(source(), async x => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 1));
        return x * 2;
      });
      
      const results = [];
      for await (const value of mapped) {
        results.push(value);
      }
      
      expect(results).toEqual([2, 4]);
    });
  });
  
  describe("filterStream", () => {
    it("should filter stream values", async () => {
      async function* source() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      }
      
      const filtered = filterStream(source(), x => x % 2 === 0);
      const results = [];
      for await (const value of filtered) {
        results.push(value);
      }
      
      expect(results).toEqual([2, 4]);
    });
    
    it("should handle async predicate functions", async () => {
      async function* source() {
        yield 1;
        yield 2;
      }
      
      const filtered = filterStream(source(), async x => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 1));
        return x % 2 === 0;
      });
      
      const results = [];
      for await (const value of filtered) {
        results.push(value);
      }
      
      expect(results).toEqual([2]);
    });
  });
  
  describe("withErrorBoundary", () => {
    it("should catch and handle errors in streams", async () => {
      async function* errorStream() {
        yield 1;
        yield 2;
        throw new Error("Stream error");
      }
      
      const results: number[] = [];
      const errors: string[] = [];
      
      const boundedStream = withErrorBoundary(errorStream(), (error) => {
        errors.push(error.message);
        return -1; // fallback value
      });
      
      try {
        for await (const value of boundedStream) {
          results.push(value);
        }
      } catch (error) {
        // Should still propagate error after fallback
        expect(error).toBeInstanceOf(Error);
      }
      
      expect(results).toEqual([1, 2, -1]);
      expect(errors).toEqual(['Stream error']);
    });
  });
  
  describe("withTimeout", () => {
    it("should timeout slow streams", async () => {
      async function* slowStream() {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 100)); // Longer than timeout
        yield 2;
      }
      
      const results = [];
      const timedStream = withTimeout(slowStream(), 50, () => 'timeout' as any);
      
      for await (const value of timedStream) {
        results.push(value);
      }
      
      expect(results).toEqual([1, 'timeout']);
    });
  });
  
  describe("bufferStream", () => {
    it("should buffer stream events into batches", async () => {
      async function* source() {
        for (let i = 1; i <= 5; i++) {
          yield i;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const results = [];
      const buffered = bufferStream(source(), 3, 100);
      
      for await (const batch of buffered) {
        results.push(batch);
      }
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].length).toBeGreaterThan(0);
      
      // Should have batched the items
      const flattened = results.flat();
      expect(flattened).toEqual([1, 2, 3, 4, 5]);
    });
  });
});