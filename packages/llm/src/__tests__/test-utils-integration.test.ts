// src/__tests__/test-utils-integration.test.ts
// Integration tests showing how to use @sage/test-utils with @sage/llm

import { describe, it, expect, beforeEach } from 'vitest';
import { createChatStream, setProvider } from '../api.js';
import { StreamEvent } from '../types.js';
import { makeLLM } from '@sage/test-utils';

describe('test-utils integration', () => {
  beforeEach(() => {
    // Reset any mocked providers
  });

  it('should work with the test-utils LLM adapter', async () => {
    // Create a deterministic test LLM client using test-utils
    const testLLM = makeLLM({ seed: 42 });
    
    // Create an adapter to bridge the interface differences
    const bridgedProvider = {
      name: 'test-utils-bridge',
      models: async () => [{ id: 'test-model', name: 'test-model' }],
      chat: async function* (opts: any): AsyncGenerator<StreamEvent, void, unknown> {
        const stream = await testLLM.createChatStream(opts);
        for await (const event of stream) {
          // Bridge the event format differences
          if (event.type === 'text') {
            yield { type: 'text' as const, value: event.text || '' }; // Convert text -> value
          } else if (event.type === 'done') {
            yield { type: 'end' as const }; // Convert done -> end
          } else if (event.type === 'tool_call' && event.toolCall) {
            yield { 
              type: 'tool_call' as const, 
              toolName: event.toolCall.name,
              arguments: event.toolCall.args,
              callId: event.toolCall.id
            };
          } else if (event.type === 'tool_result' && event.toolResult) {
            yield {
              type: 'tool_result' as const,
              callId: event.toolResult.id,
              result: event.toolResult.result
            };
          }
        }
      }
    };
    
    setProvider(bridgedProvider);
    
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
    
    // Verify we got the expected events (including round events added by createChatStream)
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(event => event.type === "text")).toBe(true);
    expect(events.some(event => event.type === "end")).toBe(true);
    expect(events.some(event => event.type === "round_start")).toBe(true);
    expect(events.some(event => event.type === "round_end")).toBe(true);
    
    // Verify deterministic behavior - same input should produce same output
    const testLLM2 = makeLLM({ seed: 42 });
    const bridgedProvider2 = {
      ...bridgedProvider,
      chat: async function* (opts: any): AsyncGenerator<StreamEvent, void, unknown> {
        const stream = await testLLM2.createChatStream(opts);
        for await (const event of stream) {
          if (event.type === 'text') {
            yield { type: 'text' as const, value: event.text || '' };
          } else if (event.type === 'done') {
            yield { type: 'end' as const };
          } else if (event.type === 'tool_call' && event.toolCall) {
            yield { 
              type: 'tool_call' as const, 
              toolName: event.toolCall.name,
              arguments: event.toolCall.args,
              callId: event.toolCall.id
            };
          } else if (event.type === 'tool_result' && event.toolResult) {
            yield {
              type: 'tool_result' as const,
              callId: event.toolResult.id,
              result: event.toolResult.result
            };
          }
        }
      }
    };
    setProvider(bridgedProvider2);
    
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
    
    // Create bridge adapter for tool calls
    const toolBridgeProvider = {
      name: 'test-utils-tool-bridge',
      models: async () => [{ id: 'test-model', name: 'test-model' }],
      chat: async function* (opts: any): AsyncGenerator<StreamEvent, void, unknown> {
        const stream = await testLLM.createChatStream(opts);
        for await (const event of stream) {
          if (event.type === 'text') {
            yield { type: 'text' as const, value: event.text || '' };
          } else if (event.type === 'done') {
            yield { type: 'end' as const };
          } else if (event.type === 'tool_call' && event.toolCall) {
            yield { 
              type: 'tool_call' as const, 
              toolName: event.toolCall.name,
              arguments: event.toolCall.args,
              callId: event.toolCall.id
            };
          } else if (event.type === 'tool_result' && event.toolResult) {
            yield {
              type: 'tool_result' as const,
              callId: event.toolResult.id,
              result: event.toolResult.result
            };
          }
        }
      }
    };
    
    setProvider(toolBridgeProvider);
    
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
    
    // Note: Tool calls are random (30% chance), so we can't guarantee they'll happen
    // But we can verify the stream structure is correct
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(event => event.type === "text")).toBe(true);
    expect(events.some(event => event.type === "end")).toBe(true);
  });

  it('should produce consistent responses with the same seed', async () => {
    // Create multiple instances with the same seed
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const testLLM = makeLLM({ seed: 999 });
      
      // Create bridge for each instance
      const bridgeProvider = {
        name: `test-utils-bridge-${i}`,
        models: async () => [{ id: 'test-model', name: 'test-model' }],
        chat: async function* (opts: any): AsyncGenerator<StreamEvent, void, unknown> {
          const stream = await testLLM.createChatStream(opts);
          for await (const event of stream) {
            if (event.type === 'text') {
              yield { type: 'text' as const, value: event.text || '' };
            } else if (event.type === 'done') {
              yield { type: 'end' as const };
            }
          }
        }
      };
      
      setProvider(bridgeProvider);
      
      const stream = await createChatStream({
        model: "test-model",
        messages: [
          { role: "user", content: "Tell me a greeting" }
        ]
      });
      
      const textEvents = [];
      for await (const event of stream) {
        if (event.type === "text") {
          textEvents.push(event.value);
        }
      }
      
      responses.push(textEvents.join(''));
    }
    
    // All responses should be identical due to deterministic seeding
    expect(responses[0]).toBe(responses[1]);
    expect(responses[1]).toBe(responses[2]);
    expect(responses[0].length).toBeGreaterThan(0);
  });
});