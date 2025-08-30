// src/__tests__/adapters.test.ts
// Comprehensive adapter integration tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamEvent, ChatOptions } from '../types.js';
import { 
  BaseAdapter, 
  ProviderFactory, 
  AdapterRegistry,
  OpenAIAdapter,
  AnthropicAdapter,
  LMStudioAdapter,
  TestProvider,
  TestProviderFactory,
  createAdapter,
  listAdapters
} from '../adapters/index.js';

describe('Provider Adapters', () => {
  describe('BaseAdapter', () => {
    class MockAdapter extends BaseAdapter {
      constructor() {
        super('mock', { 
          apiKey: 'test',
          maxTokensPerRequest: 1000 
        });
      }

      async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
        this.validateChatOptions(opts);
        yield { type: 'text', value: 'Mock response' };
        yield { type: 'end' };
      }

      async models() {
        return [{ id: 'mock-model', name: 'Mock Model', supportsStreaming: true, supportsToolCalls: false }];
      }
    }

    it('should validate chat options', async () => {
      const adapter = new MockAdapter();
      
      // Should throw on missing model
      await expect(async () => {
        const stream = adapter.chat({ model: '', messages: [] });
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('Model is required');
      
      // Should throw on empty messages
      await expect(async () => {
        const stream = adapter.chat({ model: 'test', messages: [] });
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('cannot be empty');
    });

    it('should handle token limits', async () => {
      const adapter = new MockAdapter();
      
      // Create a message that would exceed token limit
      const longMessage = 'a'.repeat(5000); // Roughly 1250 tokens
      
      await expect(async () => {
        const stream = adapter.chat({
          model: 'test',
          messages: [{ role: 'user', content: longMessage }]
        });
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('exceeds maximum token limit');
    });

    it('should provide retry functionality', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Another temporary error'))
        .mockResolvedValueOnce('success');

      const adapter = new MockAdapter();
      const result = await (adapter as any).withRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should convert tool schemas correctly', async () => {
      const adapter = new MockAdapter();
      
      const tools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} }
        }
      ];
      
      const converted = (adapter as any).convertToolSchemas(tools);
      
      expect(converted).toEqual([{
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} }
        }
      }]);
    });
  });

  describe('TestProvider', () => {
    it('should provide deterministic responses', async () => {
      const provider = TestProviderFactory.simple('Hello, test!');
      
      const stream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }
      
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', value: 'Hello, test!' });
      expect(events[1]).toEqual({ 
        type: 'end', 
        usage: { prompt: 10, completion: 5 } 
      });
    });

    it('should support streaming with delays', async () => {
      const provider = TestProviderFactory.streaming('Hello World', 10);
      
      const startTime = Date.now();
      const events = [];
      
      const stream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      for await (const event of stream) {
        events.push(event);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have taken some time due to delays
      expect(duration).toBeGreaterThan(50);
      expect(events.some(e => e.type === 'text')).toBe(true);
    });

    it('should simulate tool calls', async () => {
      const provider = TestProviderFactory.withTools([
        {
          name: 'calculator',
          arguments: { operation: 'add', a: 2, b: 3 },
          result: 5
        }
      ]);
      
      const stream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Calculate 2+3' }]
      });
      
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }
      
      expect(events.some(e => e.type === 'tool_call' && e.toolName === 'calculator')).toBe(true);
      expect(events.some(e => e.type === 'tool_result' && e.result === 5)).toBe(true);
    });

    it('should simulate errors', async () => {
      const provider = TestProviderFactory.error('Test error message');
      
      await expect(async () => {
        const stream = provider.chat({
          model: 'test-model',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('Test error message');
    });

    it('should handle conditional responses', async () => {
      const provider = new TestProvider({
        responses: [
          {
            messageContains: 'weather',
            text: 'It is sunny today!'
          },
          {
            messageContains: 'time',
            text: 'It is 3:00 PM'
          }
        ],
        defaultResponse: 'I do not understand'
      });
      
      // Test weather response
      const weatherStream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'What is the weather like?' }]
      });
      
      const weatherEvents = [];
      for await (const event of weatherStream) {
        if (event.type === 'text') {
          weatherEvents.push(event.value);
        }
      }
      
      expect(weatherEvents.join('')).toContain('sunny');
      
      // Test time response
      const timeStream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'What time is it?' }]
      });
      
      const timeEvents = [];
      for await (const event of timeStream) {
        if (event.type === 'text') {
          timeEvents.push(event.value);
        }
      }
      
      expect(timeEvents.join('')).toContain('3:00');
    });

    it('should track usage statistics', async () => {
      const provider = TestProviderFactory.simple();
      
      // Make several requests
      for (let i = 0; i < 3; i++) {
        const stream = provider.chat({
          model: 'test-model',
          messages: [{ role: 'user', content: `Request ${i}` }]
        });
        
        for await (const event of stream) {
          // Consume the stream
        }
      }
      
      const usage = provider.getUsage();
      expect(usage.requests).toBe(3);
      expect(usage.tokens.prompt).toBeGreaterThan(0);
      expect(usage.tokens.completion).toBeGreaterThan(0);
    });

    it('should support dynamic configuration', async () => {
      const provider = new TestProvider();
      
      // Configure responses dynamically
      provider.setResponses([
        { text: 'Dynamic response' }
      ]);
      
      const stream = provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      const events = [];
      for await (const event of stream) {
        if (event.type === 'text') {
          events.push(event.value);
        }
      }
      
      expect(events.join('')).toBe('Dynamic response');
    });
  });

  describe('AdapterRegistry', () => {
    beforeEach(() => {
      // Registry is globally configured, just test the interface
    });

    it('should list available adapters', () => {
      const adapters = listAdapters();
      
      expect(adapters.length).toBeGreaterThan(0);
      expect(adapters.map(a => a.name)).toContain('test');
      expect(adapters.map(a => a.name)).toContain('openai');
      expect(adapters.map(a => a.name)).toContain('anthropic');
      expect(adapters.map(a => a.name)).toContain('lmstudio');
    });

    it('should create adapters by name', () => {
      const testAdapter = createAdapter('test', {});
      expect(testAdapter).toBeInstanceOf(TestProvider);
    });

    it('should validate required configuration', () => {
      // OpenAI requires apiKey
      expect(() => createAdapter('openai', {})).toThrow('Missing required configuration');
      
      // Test doesn't require any config
      expect(() => createAdapter('test', {})).not.toThrow();
    });

    it('should handle unknown adapters', () => {
      expect(() => createAdapter('unknown', {})).toThrow('Unknown adapter');
    });
  });

  describe('LMStudioAdapter', () => {
    it('should require dependencies', async () => {
      const adapter = new LMStudioAdapter();
      
      await expect(async () => {
        const stream = adapter.chat({
          model: 'local',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('dependencies not configured');
    });

    it('should handle missing model', async () => {
      const mockDeps = {
        getSelectedModel: vi.fn().mockResolvedValue(null),
        createChatSession: vi.fn(),
        toolsRegistry: { getLMStudioTools: vi.fn().mockReturnValue({}) }
      };
      
      const adapter = new LMStudioAdapter({ deps: mockDeps });
      
      await expect(async () => {
        const stream = adapter.chat({
          model: 'local',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('no model selected');
    });

    it('should bridge act-loop callbacks correctly', async () => {
      const mockModel = {
        act: vi.fn().mockImplementation(async (chat, tools, callbacks) => {
          // Simulate LM Studio callbacks
          callbacks.onRoundStart?.(0);
          callbacks.onPredictionFragment?.('Hello');
          callbacks.onPredictionFragment?.(' World');
          callbacks.onRoundEnd?.(0);
        })
      };
      
      const mockDeps = {
        getSelectedModel: vi.fn().mockResolvedValue(mockModel),
        createChatSession: vi.fn().mockResolvedValue({}),
        toolsRegistry: { getLMStudioTools: vi.fn().mockReturnValue({}) }
      };
      
      const adapter = new LMStudioAdapter({ deps: mockDeps });
      
      const stream = adapter.chat({
        model: 'local',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }
      
      expect(events).toContainEqual({ type: 'round_start', index: 0 });
      expect(events).toContainEqual({ type: 'text', value: 'Hello' });
      expect(events).toContainEqual({ type: 'text', value: ' World' });
      expect(events).toContainEqual({ type: 'round_end', index: 0 });
      expect(events).toContainEqual({ type: 'end' });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle provider switching', async () => {
      // Test switching between different providers
      const providers = [
        TestProviderFactory.simple('Response 1'),
        TestProviderFactory.simple('Response 2'),
        TestProviderFactory.simple('Response 3')
      ];
      
      for (let i = 0; i < providers.length; i++) {
        const stream = providers[i].chat({
          model: 'test',
          messages: [{ role: 'user', content: `Request ${i}` }]
        });
        
        const textEvents = [];
        for await (const event of stream) {
          if (event.type === 'text') {
            textEvents.push(event.value);
          }
        }
        
        expect(textEvents.join('')).toBe(`Response ${i + 1}`);
      }
    });

    it('should handle concurrent requests', async () => {
      const provider = TestProviderFactory.streaming('Concurrent response');
      
      // Start multiple concurrent requests
      const streams = Array.from({ length: 3 }, (_, i) =>
        provider.chat({
          model: 'test',
          messages: [{ role: 'user', content: `Concurrent ${i}` }]
        })
      );
      
      // Process all streams concurrently
      const results = await Promise.all(
        streams.map(async (stream) => {
          const events = [];
          for await (const event of stream) {
            events.push(event);
          }
          return events;
        })
      );
      
      expect(results).toHaveLength(3);
      
      // Each result should have text events
      for (const events of results) {
        expect(events.some(e => e.type === 'text')).toBe(true);
        expect(events.some(e => e.type === 'end')).toBe(true);
      }
    });

    it('should handle error recovery', async () => {
      // Create two separate providers: one that errors, one that succeeds
      const errorProvider = TestProviderFactory.error('First call fails');
      const successProvider = TestProviderFactory.simple('Second call succeeds');
      
      // First call should fail
      await expect(async () => {
        const stream = errorProvider.chat({
          model: 'test',
          messages: [{ role: 'user', content: 'First' }]
        });
        
        for await (const event of stream) {
          // Should not reach here
        }
      }).rejects.toThrow('First call fails');
      
      // Second call should succeed
      const secondStream = successProvider.chat({
        model: 'test',
        messages: [{ role: 'user', content: 'Second' }]
      });
      
      const events = [];
      for await (const event of secondStream) {
        if (event.type === 'text') {
          events.push(event.value);
        }
      }
      
      expect(events.join('')).toContain('succeeds');
    });
  });
});