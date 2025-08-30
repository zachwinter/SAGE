// Example test showing off the new custom matchers
import { describe, it, expect } from 'vitest';
import { TestProviderFactory } from '../adapters/test.js';
import { createChatStream, setProvider } from '../api.js';

describe('Custom Matchers Examples', () => {
  it('should demonstrate toHaveValidStreamFormat matcher', async () => {
    const provider = TestProviderFactory.simple('Hello World!');
    setProvider(provider);
    
    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Use our custom matcher
    expect(events).toHaveValidStreamFormat();
  });

  it('should demonstrate toContainToolCall matcher', async () => {
    const provider = TestProviderFactory.withTools([
      {
        name: 'search',
        arguments: { query: 'test query' },
        result: { results: ['item1', 'item2'] }
      }
    ]);
    setProvider(provider);
    
    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Search for something' }],
      tools: [{
        name: 'search',
        description: 'Search tool',
        parameters: { type: 'object', properties: { query: { type: 'string' } } }
      }]
    });
    
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Use our custom matchers
    expect(events).toContainToolCall('search', { query: 'test query' });
    expect(events).toCompleteWithoutErrors();
  });

  it('should demonstrate toHaveTextContent matcher', async () => {
    const provider = TestProviderFactory.simple('This is a test response with specific content!');
    setProvider(provider);
    
    const stream = await createChatStream({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Say something specific' }]
    });
    
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Use our custom matcher
    expect(events).toHaveTextContent('specific content');
    expect(events).toHaveValidStreamFormat();
    expect(events).toCompleteWithoutErrors();
  });
});