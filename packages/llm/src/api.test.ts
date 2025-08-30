// src/api.test.ts
// Basic tests for the API functionality

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatStream } from "./api.js";
import { setProvider } from "./registry.js";
import type { LLMProvider, ChatOptions, StreamEvent } from "./types.js";

describe("api", () => {
  beforeEach(() => {
    // Reset any mocked providers
  });

  it("should throw an error when no provider is configured", async () => {
    await expect(createChatStream({ 
      model: "test-model", 
      messages: [{ role: "user", content: "test" }] 
    })).rejects.toThrow("No LLM provider configured");
  });

  it("should successfully create a chat stream with a valid provider", async () => {
    // Mock provider that returns a streaming response
    const mockProvider: LLMProvider = {
      name: "test-provider",
      chat: async function* (opts: ChatOptions): AsyncIterable<StreamEvent> {
        yield { type: "text", value: "Hello, world!" };
        yield { type: "end" };
      },
      models: async () => [{ id: "test-model", name: "test-model" }]
    };

    setProvider(mockProvider);
    
    const stream = await createChatStream({
      model: "test-model",
      messages: [{ role: "user", content: "test" }]
    });
    
    expect(stream).toBeDefined();
    
    // Collect events from the stream
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: "round_start", index: 0 });
    expect(events[1]).toEqual({ type: "text", value: "Hello, world!" });
    expect(events[2]).toEqual({ type: "round_end", index: 0 });
    expect(events[3]).toEqual({ type: "end" });
  });

  it("should handle non-streaming providers", async () => {
    // Mock provider that returns a non-streaming response
    const mockProvider: LLMProvider = {
      name: "test-provider",
      chat: async function* (opts: ChatOptions): AsyncIterable<StreamEvent> {
        yield { type: "text", value: "Hello, world!" };
        yield { type: "end" };
      },
      models: async () => [{ id: "test-model", name: "test-model" }]
    };

    setProvider(mockProvider);
    
    const stream = await createChatStream({
      model: "test-model",
      messages: [{ role: "user", content: "test" }]
    });
    
    expect(stream).toBeDefined();
    
    // Collect events from the stream
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: "round_start", index: 0 });
    expect(events[1]).toEqual({ type: "text", value: "Hello, world!" });
    expect(events[2]).toEqual({ type: "round_end", index: 0 });
    expect(events[3]).toEqual({ type: "end" });
  });
});