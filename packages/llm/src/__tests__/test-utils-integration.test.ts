// src/__tests__/test-utils-integration.test.ts
// Integration tests showing how to use @sage/test-utils with @sage/llm

import { describe, it, expect, beforeEach } from 'vitest';
import { createChatStream, setProvider } from '../api.js';
import { makeLLM } from '@sage/test-utils/src/adapters/llm.js';

describe('test-utils integration', () => {
  beforeEach(() => {
    // Reset any mocked providers
  });

  it('should work with the test-utils LLM adapter', async () => {
    // Create a deterministic test LLM client using test-utils
    const testLLM = makeLLM({ seed: 42 });
    
    // Set it as the provider
    setProvider(testLLM as any); // Type assertion needed due to interface differences
    
    // Create a chat stream
    const stream = await createChatStream({
      model: "test-model",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you?" }
      ]
    });
    
    // Collect events from the stream
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Verify we got the expected events
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(event => event.type === "text")).toBe(true);
    expect(events.some(event => event.type === "end")).toBe(true);
    
    // Verify deterministic behavior - same input should produce same output
    const testLLM2 = makeLLM({ seed: 42 });
    setProvider(testLLM2 as any);
    
    const stream2 = await createChatStream({
      model: "test-model",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you?" }
      ]
    });
    
    const events2 = [];
    for await (const event of stream2) {
      events2.push(event);
    }
    
    // The events should be identical due to deterministic seeding
    expect(events).toEqual(events2);
  });

  it('should support tool calls with test-utils adapter', async () => {
    // Create a test LLM with tool support
    const testLLM = makeLLM({ 
      seed: 123,
      tools: {
        calculator: async (input: any) => {
          if (input.operation === 'add') {
            return input.a + input.b;
          }
          return 0;
        }
      }
    });
    
    setProvider(testLLM as any);
    
    // Create a chat stream that should trigger tool calls
    const stream = await createChatStream({
      model: "test-model",
      messages: [
        { role: "user", content: "Calculate 2+3 using the calculator tool" }
      ],
      tools: [{
        name: "calculator",
        description: "A simple calculator tool",
        parameters: {
          type: "object",
          properties: {
            operation: { type: "string" },
            a: { type: "number" },
            b: { type: "number" }
          }
        }
      }]
    });
    
    // Collect events from the stream
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Verify we got tool call events
    expect(events.some(event => event.type === "tool_call")).toBe(true);
    expect(events.some(event => event.type === "tool_result")).toBe(true);
  });

  it('should produce consistent responses with the same seed', async () => {
    // Create multiple instances with the same seed
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const testLLM = makeLLM({ seed: 999 });
      setProvider(testLLM as any);
      
      const stream = await createChatStream({
        model: "test-model",
        messages: [
          { role: "user", content: "Tell me a greeting" }
        ]
      });
      
      const textEvents = [];
      for await (const event of stream) {
        if (event.type === "text") {
          textEvents.push(event.text);
        }
      }
      
      responses.push(textEvents.join(''));
    }
    
    // All responses should be identical
    expect(responses[0]).toBe(responses[1]);
    expect(responses[1]).toBe(responses[2]);
  });
});