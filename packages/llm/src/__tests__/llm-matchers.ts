// Custom matchers for LLM testing
import { expect } from 'vitest';
import type { StreamEvent } from '../types.js';

interface CustomMatchers<R = unknown> {
  toContainToolCall(toolName: string, args?: any): R;
  toHaveValidStreamFormat(): R;
  toHaveToolResult(callId: string, result?: any): R;
  toCompleteWithoutErrors(): R;
  toHaveTextContent(expectedText?: string): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/**
 * Checks if stream events contain a specific tool call
 */
expect.extend({
  toContainToolCall(received: StreamEvent[], toolName: string, args?: any) {
    const toolCallEvents = received.filter(event => event.type === 'tool_call');
    const matchingToolCall = toolCallEvents.find(event => 
      event.type === 'tool_call' && 
      'toolName' in event && 
      event.toolName === toolName &&
      (args === undefined || this.equals(event.arguments, args))
    );

    if (matchingToolCall) {
      return {
        message: () => `Expected stream not to contain tool call for "${toolName}"`,
        pass: true
      };
    } else {
      return {
        message: () => {
          const toolNames = toolCallEvents
            .filter(event => event.type === 'tool_call' && 'toolName' in event)
            .map(event => `"${(event as any).toolName}"`)
            .join(', ');
          
          return `Expected stream to contain tool call for "${toolName}"${
            args ? ` with arguments ${JSON.stringify(args)}` : ''
          }.\nFound tool calls: ${toolNames || 'none'}`;
        },
        pass: false
      };
    }
  },

  /**
   * Validates that stream events follow the expected format
   */
  toHaveValidStreamFormat(received: StreamEvent[]) {
    const errors: string[] = [];
    
    // Check that we have events
    if (received.length === 0) {
      errors.push('Stream contains no events');
    }
    
    // Check for required event types
    const hasText = received.some(event => event.type === 'text');
    const hasEnd = received.some(event => event.type === 'end');
    
    if (!hasEnd) {
      errors.push('Stream missing "end" event');
    }
    
    // Validate event structure
    received.forEach((event, index) => {
      if (!event.type) {
        errors.push(`Event at index ${index} missing "type" property`);
      }
      
      if (event.type === 'text' && !('value' in event)) {
        errors.push(`Text event at index ${index} missing "value" property`);
      }
      
      if (event.type === 'tool_call') {
        if (!('toolName' in event)) {
          errors.push(`Tool call event at index ${index} missing "toolName" property`);
        }
        if (!('callId' in event)) {
          errors.push(`Tool call event at index ${index} missing "callId" property`);
        }
      }
      
      if (event.type === 'tool_result' && !('callId' in event)) {
        errors.push(`Tool result event at index ${index} missing "callId" property`);
      }
    });
    
    if (errors.length === 0) {
      return {
        message: () => 'Expected stream to have invalid format',
        pass: true
      };
    } else {
      return {
        message: () => `Stream format validation failed:\n${errors.join('\n')}`,
        pass: false
      };
    }
  },

  /**
   * Checks if stream contains a tool result with specific callId and result
   */
  toHaveToolResult(received: StreamEvent[], callId: string, result?: any) {
    const toolResultEvents = received.filter(event => 
      event.type === 'tool_result' && 
      'callId' in event && 
      event.callId === callId
    );
    
    if (toolResultEvents.length === 0) {
      return {
        message: () => `Expected stream to contain tool result with callId "${callId}"`,
        pass: false
      };
    }
    
    if (result !== undefined) {
      const matchingResult = toolResultEvents.find(event =>
        'result' in event && this.equals(event.result, result)
      );
      
      if (!matchingResult) {
        return {
          message: () => `Expected stream to contain tool result with callId "${callId}" and result ${JSON.stringify(result)}`,
          pass: false
        };
      }
    }
    
    return {
      message: () => `Expected stream not to contain tool result with callId "${callId}"`,
      pass: true
    };
  },

  /**
   * Checks that stream completed without error events
   */
  toCompleteWithoutErrors(received: StreamEvent[]) {
    const errorEvents = received.filter(event => event.type === 'error');
    
    if (errorEvents.length === 0) {
      return {
        message: () => 'Expected stream to contain error events',
        pass: true
      };
    } else {
      return {
        message: () => `Expected stream to complete without errors, but found ${errorEvents.length} error event(s):\n${
          errorEvents.map((event: any) => event.error || 'Unknown error').join('\n')
        }`,
        pass: false
      };
    }
  },

  /**
   * Checks if stream contains expected text content
   */
  toHaveTextContent(received: StreamEvent[], expectedText?: string) {
    const textEvents = received.filter(event => event.type === 'text');
    
    if (textEvents.length === 0) {
      return {
        message: () => 'Expected stream to contain text events',
        pass: false
      };
    }
    
    if (expectedText !== undefined) {
      const allText = textEvents
        .map(event => 'value' in event ? event.value : '')
        .join('');
      
      if (allText.includes(expectedText)) {
        return {
          message: () => `Expected stream text not to contain "${expectedText}"`,
          pass: true
        };
      } else {
        return {
          message: () => `Expected stream text to contain "${expectedText}"\nReceived: "${allText}"`,
          pass: false
        };
      }
    }
    
    return {
      message: () => 'Expected stream not to contain text events',
      pass: true
    };
  }
});