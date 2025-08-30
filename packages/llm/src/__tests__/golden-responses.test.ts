// Golden tests for LLM response patterns using @sage/test-utils
import { describe, it, expect } from 'vitest';
import { golden, createTempWorkspace } from '@sage/test-utils';
import { TestProviderFactory } from '../adapters/test.js';
import { createChatStream, setProvider } from '../api.js';

describe('Golden Response Patterns', () => {
  it('should maintain consistent streaming response format', async () => {
    const workspace = await createTempWorkspace();
    
    // Create a deterministic test provider
    const provider = TestProviderFactory.simple('Hello, this is a deterministic test response!');
    setProvider(provider);
    
    // Create a chat stream and collect all events
    const stream = await createChatStream({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ]
    });
    
    const events = [];
    for await (const event of stream) {
      // Normalize timestamps and ids for consistent snapshots
      if (event.type === 'tool_call' && 'callId' in event) {
        events.push({ ...event, callId: 'normalized_call_id' });
      } else if (event.type === 'tool_result' && 'callId' in event) {
        events.push({ ...event, callId: 'normalized_call_id' });
      } else {
        events.push(event);
      }
    }
    
    // Write the events to a golden file for comparison
    await workspace.file('response-events.json', JSON.stringify(events, null, 2));
    
    // Use golden testing to ensure response format remains consistent
    await golden(workspace, 'response-events.json');
  });

  it('should maintain consistent tool call format', async () => {
    const workspace = await createTempWorkspace();
    
    // Create a provider with tool calls
    const provider = TestProviderFactory.withTools([
      {
        name: 'calculator',
        arguments: { operation: 'add', a: 5, b: 3 },
        result: 8
      }
    ]);
    setProvider(provider);
    
    const stream = await createChatStream({
      model: 'test-model',
      messages: [
        { role: 'user', content: 'Calculate 5 + 3' }
      ],
      tools: [{
        name: 'calculator',
        description: 'Simple calculator',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string' },
            a: { type: 'number' },
            b: { type: 'number' }
          }
        }
      }]
    });
    
    const events = [];
    for await (const event of stream) {
      // Normalize call IDs for consistent snapshots
      if (event.type === 'tool_call' && 'callId' in event) {
        events.push({ ...event, callId: 'normalized_call_id' });
      } else if (event.type === 'tool_result' && 'callId' in event) {
        events.push({ ...event, callId: 'normalized_call_id' });
      } else {
        events.push(event);
      }
    }
    
    await workspace.file('tool-events.json', JSON.stringify(events, null, 2));
    await golden(workspace, 'tool-events.json');
  });

  it('should maintain consistent error response format', async () => {
    const workspace = await createTempWorkspace();
    
    const errorProvider = TestProviderFactory.error('Simulated provider error');
    setProvider(errorProvider);
    
    let errorCaught = null;
    let events = [];
    
    try {
      const stream = await createChatStream({
        model: 'test-model',
        messages: [{ role: 'user', content: 'This should error' }]
      });
      
      for await (const event of stream) {
        events.push(event);
      }
    } catch (error) {
      errorCaught = {
        message: error instanceof Error ? error.message : String(error),
        type: 'ProviderError'
      };
    }
    
    const result = {
      events,
      error: errorCaught
    };
    
    await workspace.file('error-response.json', JSON.stringify(result, null, 2));
    await golden(workspace, 'error-response.json');
  });
});