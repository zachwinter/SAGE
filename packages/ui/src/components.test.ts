import { describe, it, expect } from 'vitest';
import { Chat, AssistantTurn, UserMessage, ToolCall, Spinner, type StreamEvent } from './components';

describe('@sage/ui components', () => {
  it('should export Chat component', () => {
    expect(Chat).toBeDefined();
    expect(typeof Chat).toBe('function');
  });

  it('should export AssistantTurn component', () => {
    expect(AssistantTurn).toBeDefined();
    expect(typeof AssistantTurn).toBe('function');
  });

  it('should export UserMessage component', () => {
    expect(UserMessage).toBeDefined();
    expect(typeof UserMessage).toBe('function');
  });

  it('should export ToolCall component', () => {
    expect(ToolCall).toBeDefined();
    expect(typeof ToolCall).toBe('function');
  });

  it('should export Spinner component', () => {
    expect(Spinner).toBeDefined();
    expect(typeof Spinner).toBe('function');
  });

  it('should throw errors when components are used without adapters', () => {
    // Create a mock stream for testing
    const mockStream = (async function* () {
      yield { type: 'text' as const, value: 'test' } as StreamEvent;
    })();

    expect(() => Chat({ stream: mockStream })).toThrow('Chat component must be implemented by a renderer adapter');
    expect(() => AssistantTurn()).toThrow('AssistantTurn component must be implemented by a renderer adapter');
    expect(() => UserMessage({ children: 'test' })).toThrow('UserMessage component must be implemented by a renderer adapter');
    expect(() => ToolCall({ children: 'test' })).toThrow('ToolCall component must be implemented by a renderer adapter');
    expect(() => Spinner()).toThrow('Spinner component must be implemented by a renderer adapter');
  });
});