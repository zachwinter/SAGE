// src/__tests__/streaming.test.ts
// Comprehensive tests for streaming functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StreamEvent, LLMProvider, ChatOptions, StreamOptions } from '../types.js';
import { createChatStream } from '../api.js';
import { setProvider } from '../registry.js';
import { AsyncQueue, withErrorBoundary, withTimeout, bufferStream } from '../stream-utils.js';
import { 
  registerEventNormalizer, 
  normalizeEventStream, 
  withEventNormalization,
  type EventNormalizer,
  type NormalizationContext
} from '../event-normalization.js';

describe('AsyncQueue', () => {
  let queue: AsyncQueue<number>;

  beforeEach(() => {
    queue = new AsyncQueue<number>();
  });

  it('should handle basic push and iteration', async () => {
    queue.push(1);
    queue.push(2);
    queue.push(3);
    queue.finish();

    const results = [];
    for await (const value of queue) {
      results.push(value);
    }

    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle backpressure', async () => {
    const smallQueue = new AsyncQueue<number>(2);
    
    expect(smallQueue.push(1)).toBe(true);
    expect(smallQueue.push(2)).toBe(true);
    expect(smallQueue.push(3)).toBe(false); // Should signal backpressure

    const stats = smallQueue.getStats();
    expect(stats.queueLength).toBe(2);
    expect(stats.droppedItems).toBe(1);
    expect(stats.maxBufferSize).toBe(2);
  });

  it('should detect backpressure conditions', () => {
    const queue = new AsyncQueue<number>(10);
    
    // Fill to 80% capacity
    for (let i = 0; i < 8; i++) {
      queue.push(i);
    }
    
    expect(queue.isBackpressured()).toBe(true);
  });

  it('should handle errors properly', async () => {
    queue.push(1);
    queue.fail(new Error('Test error'));

    const results = [];
    try {
      for await (const value of queue) {
        results.push(value);
      }
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
    }
    
    // Should have gotten the first value before error
    expect(results).toEqual([1]);
  });
});

describe('Stream Utilities', () => {
  it('should handle error boundaries', async () => {
    const errorStream = async function* () {
      yield 1;
      yield 2;
      throw new Error('Stream error');
    };

    const results = [];
    const errors = [];
    
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

  it('should handle stream timeouts', async () => {
    const slowStream = async function* () {
      yield 1;
      await new Promise(resolve => setTimeout(resolve, 100));
      yield 2;
    };

    const results = [];
    const timedStream = withTimeout(slowStream(), 50, () => 'timeout');

    for await (const value of timedStream) {
      results.push(value);
    }

    expect(results).toEqual([1, 'timeout']);
  });

  it('should buffer stream events', async () => {
    const stream = async function* () {
      for (let i = 1; i <= 5; i++) {
        yield i;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };

    const results = [];
    const buffered = bufferStream(stream(), 3, 100);

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

describe('Event Normalization', () => {
  it('should register and use custom normalizers', async () => {
    const testNormalizer: EventNormalizer = {
      name: 'test',
      isProviderEvent: (event) => event && event.testEvent === true,
      normalizeEvent: (rawEvent, context) => {
        if (rawEvent.testEvent) {
          return { type: 'text', value: rawEvent.content };
        }
        return null;
      }
    };

    registerEventNormalizer(testNormalizer);

    const rawStream = async function* () {
      yield { testEvent: true, content: 'Hello' };
      yield { testEvent: true, content: ' World' };
    };

    const context: NormalizationContext = {
      requestId: 'test',
      provider: 'test',
      model: 'test-model',
      round: 0,
      callIdMap: new Map()
    };

    const results = [];
    for await (const event of normalizeEventStream(rawStream(), context)) {
      results.push(event);
    }

    expect(results).toEqual([
      { type: 'text', value: 'Hello' },
      { type: 'text', value: ' World' }
    ]);
  });

  it('should wrap providers with event normalization', async () => {
    const mockProvider: LLMProvider = {
      name: 'mock',
      models: async () => [{ name: 'mock-model' }],
      chat: async function*(opts: ChatOptions) {
        yield { testEvent: true, content: 'Test response' };
      }
    };

    const testNormalizer: EventNormalizer = {
      name: 'mock',
      isProviderEvent: (event) => event && event.testEvent === true,
      normalizeEvent: (rawEvent) => {
        if (rawEvent.testEvent) {
          return { type: 'text', value: rawEvent.content };
        }
        return null;
      }
    };

    registerEventNormalizer(testNormalizer);
    const wrappedProvider = withEventNormalization(mockProvider);

    const result = await wrappedProvider.chat({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'test' }]
    });

    const events = [];
    if (Symbol.asyncIterator in result) {
      for await (const event of result) {
        events.push(event);
      }
    }

    expect(events).toEqual([
      { type: 'text', value: 'Test response' }
    ]);
  });
});

describe('createChatStream Integration', () => {
  let mockProvider: LLMProvider;

  beforeEach(() => {
    mockProvider = {
      name: 'test-provider',
      models: async () => [{ name: 'test-model' }],
      chat: vi.fn()
    };
    setProvider(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle streaming providers with round events', async () => {
    const mockStream = async function* () {
      yield { type: 'text', value: 'Hello' } as StreamEvent;
      yield { type: 'text', value: ' World' } as StreamEvent;
      yield { type: 'end' } as StreamEvent;
    };

    vi.mocked(mockProvider.chat).mockResolvedValue(mockStream());

    const streamOptions: StreamOptions = {
      enableRoundEvents: true,
      maxBufferSize: 100
    };

    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    }, streamOptions);

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'round_start', index: 0 },
      { type: 'text', value: 'Hello' },
      { type: 'text', value: ' World' },
      { type: 'round_end', index: 0 },
      { type: 'end' }
    ]);
  });

  it('should handle non-streaming providers', async () => {
    vi.mocked(mockProvider.chat).mockResolvedValue({ text: 'Hello World' });

    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'round_start', index: 0 },
      { type: 'text', value: 'Hello World' },
      { type: 'round_end', index: 0 },
      { type: 'end' }
    ]);
  });

  it('should handle provider errors with error boundaries', async () => {
    vi.mocked(mockProvider.chat).mockRejectedValue(new Error('Provider error'));

    await expect(createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    })).rejects.toThrow('Provider test-provider error: Provider error');
  });

  it('should handle stream errors gracefully', async () => {
    const errorStream = async function* () {
      yield { type: 'text', value: 'Start' } as StreamEvent;
      throw new Error('Stream error');
    };

    vi.mocked(mockProvider.chat).mockResolvedValue(errorStream());

    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
      // Error should be converted to error event
      if (event.type === 'error') {
        break;
      }
    }

    expect(events.some(e => e.type === 'round_start')).toBe(true);
    expect(events.some(e => e.type === 'text')).toBe(true);
    expect(events.some(e => e.type === 'error')).toBe(true);
  });

  it('should handle timeout configuration', async () => {
    const slowProvider: LLMProvider = {
      name: 'slow-provider',
      models: async () => [{ name: 'slow-model' }],
      chat: async (opts: ChatOptions) => {
        // Check if signal is already aborted
        if (opts.signal?.aborted) {
          throw new Error('AbortError');
        }
        
        // Wait for timeout to trigger
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 100);
          opts.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          });
        });
        
        return { text: 'Too late' };
      }
    };

    setProvider(slowProvider);

    await expect(createChatStream({
      model: 'slow-model',
      messages: [{ role: 'user', content: 'test' }],
      timeoutMs: 50
    })).rejects.toThrow('timeout after 50ms');
  });

  it('should disable round events when configured', async () => {
    vi.mocked(mockProvider.chat).mockResolvedValue({ text: 'Hello World' });

    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    }, { enableRoundEvents: false });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', value: 'Hello World' },
      { type: 'end' }
    ]);
  });
});

describe('Real-world Scenarios', () => {
  it('should handle complex multi-round conversations', async () => {
    const conversationStream = async function* () {
      yield { type: 'text', value: 'I need to call a tool.' } as StreamEvent;
      yield { type: 'tool_call', toolName: 'search', arguments: { query: 'test' }, callId: 'call1' } as StreamEvent;
      yield { type: 'tool_result', callId: 'call1', result: { results: ['found'] } } as StreamEvent;
      yield { type: 'text', value: 'Based on the results: found' } as StreamEvent;
      yield { type: 'end' } as StreamEvent;
    };

    const mockProvider: LLMProvider = {
      name: 'conversation-provider',
      models: async () => [{ name: 'conv-model' }],
      chat: async () => conversationStream()
    };

    setProvider(mockProvider);

    const stream = await createChatStream({
      model: 'conv-model',
      messages: [{ role: 'user', content: 'help me search' }]
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    // Should have proper round management around tool calls
    expect(events).toContainEqual({ type: 'round_start', index: 0 });
    expect(events).toContainEqual({ type: 'tool_call', toolName: 'search', arguments: { query: 'test' }, callId: 'call1' });
    expect(events).toContainEqual({ type: 'tool_result', callId: 'call1', result: { results: ['found'] } });
    expect(events).toContainEqual({ type: 'round_end', index: 0 });
    expect(events).toContainEqual({ type: 'end' });
  });
});