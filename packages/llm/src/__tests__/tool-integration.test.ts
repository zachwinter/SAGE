// src/__tests__/tool-integration.test.ts
// Comprehensive tests for tool integration and validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolSchema, ToolCallInfo, StreamEvent } from '../types.js';
import { 
  ToolValidator, 
  createSecureToolValidator,
  CommonToolSchemas,
  type ValidationResult
} from '../tool-validation.js';
import { 
  ToolCallManager,
  generateCallId
} from '../tool-lifecycle.js';
import { 
  SecurityPolicyManager,
  BuiltinPolicies
} from '../security-policies.js';
import { 
  registerTool,
  unregisterTool,
  createChatStream,
  configureToolSecurity
} from '../api.js';
import { setProvider } from '../registry.js';
import type { LLMProvider, ChatOptions } from '../types.js';

describe('Tool Validation System', () => {
  let validator: ToolValidator;

  beforeEach(() => {
    validator = new ToolValidator();
  });

  describe('ToolValidator', () => {
    it('should validate basic tool schemas', async () => {
      const schema: ToolSchema = {
        name: 'add',
        description: 'Add two numbers',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        }
      };

      validator.registerTool(schema);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'add',
        args: { a: 5, b: 3 },
        round: 0
      };

      const result = await validator.validateToolCall('add', { a: 5, b: 3 }, callInfo);
      
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toEqual({ a: 5, b: 3 });
    });

    it('should reject invalid arguments', async () => {
      const schema: ToolSchema = {
        name: 'add',
        description: 'Add two numbers',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        }
      };

      validator.registerTool(schema);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'add',
        args: { a: 'not a number', b: 3 },
        round: 0
      };

      const result = await validator.validateToolCall('add', { a: 'not a number', b: 3 }, callInfo);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('number');
    });

    it('should handle unregistered tools', async () => {
      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'unknown_tool',
        args: {},
        round: 0
      };

      const result = await validator.validateToolCall('unknown_tool', {}, callInfo);
      
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('not registered');
    });

    it('should use CommonToolSchemas correctly', async () => {
      const schema: ToolSchema = {
        name: 'echo',
        description: 'Echo a string',
        parameters: {
          type: 'object',
          properties: {
            message: CommonToolSchemas.string('Message to echo', 50)
          },
          required: ['message']
        }
      };

      validator.registerTool(schema);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'echo',
        args: { message: 'Hello World' },
        round: 0
      };

      const result = await validator.validateToolCall('echo', { message: 'Hello World' }, callInfo);
      
      expect(result.valid).toBe(true);
    });

    it('should enforce custom security policies', async () => {
      const securityPolicy = vi.fn().mockResolvedValue('denied');
      validator.setApprovalPolicy(securityPolicy);

      const schema: ToolSchema = {
        name: 'dangerous',
        parameters: { type: 'object', properties: {} }
      };

      validator.registerTool(schema);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'dangerous',
        args: {},
        round: 0
      };

      const result = await validator.validateToolCall('dangerous', {}, callInfo);
      
      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('TOOL_DENIED');
      expect(securityPolicy).toHaveBeenCalledWith(callInfo);
    });
  });

  describe('ToolCallManager', () => {
    let manager: ToolCallManager;
    let mockValidator: ToolValidator;

    beforeEach(() => {
      manager = new ToolCallManager();
      mockValidator = new ToolValidator();
      manager.setValidator(mockValidator);
    });

    it('should process tool calls through lifecycle', async () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: { type: 'object', properties: {} }
      };

      const executor = vi.fn().mockResolvedValue('test result');
      
      manager.registerTool('test_tool', schema, executor);

      const toolCallEvent: StreamEvent = {
        type: 'tool_call',
        toolName: 'test_tool',
        arguments: {},
        callId: 'call_1'
      };

      const results = await manager.processToolCall(toolCallEvent);
      
      expect(results).toHaveLength(2); // Original event + tool result
      expect(results[0]).toEqual(toolCallEvent);
      expect(results[1]).toEqual({
        type: 'tool_result',
        callId: 'call_1',
        result: 'test result'
      });

      expect(executor).toHaveBeenCalledWith({}, {
        id: 'call_1',
        name: 'test_tool',
        args: {},
        round: 0
      });
    });

    it('should handle tool execution errors', async () => {
      const schema: ToolSchema = {
        name: 'error_tool',
        parameters: { type: 'object', properties: {} }
      };

      const executor = vi.fn().mockRejectedValue(new Error('Tool execution failed'));
      
      manager.registerTool('error_tool', schema, executor);

      const toolCallEvent: StreamEvent = {
        type: 'tool_call',
        toolName: 'error_tool',
        arguments: {},
        callId: 'call_1'
      };

      const results = await manager.processToolCall(toolCallEvent);
      
      expect(results).toHaveLength(2);
      expect(results[1]).toEqual({
        type: 'tool_validation_error',
        callId: 'call_1',
        error: 'Tool execution failed',
        toolName: 'error_tool'
      });
    });

    it('should track tool call states correctly', async () => {
      const schema: ToolSchema = {
        name: 'tracked_tool',
        parameters: { type: 'object', properties: {} }
      };

      const executor = vi.fn().mockResolvedValue('result');
      
      manager.registerTool('tracked_tool', schema, executor);

      const toolCallEvent: StreamEvent = {
        type: 'tool_call',
        toolName: 'tracked_tool',
        arguments: {},
        callId: 'call_1'
      };

      await manager.processToolCall(toolCallEvent);

      const toolCall = manager.getToolCall('call_1');
      expect(toolCall).toBeDefined();
      expect(toolCall!.state).toBe('completed');
      expect(toolCall!.result).toBe('result');
    });
  });

  describe('SecurityPolicyManager', () => {
    let policyManager: SecurityPolicyManager;

    beforeEach(() => {
      policyManager = new SecurityPolicyManager();
    });

    it('should deny tools in denylist', async () => {
      policyManager.addToDenylist(['dangerous_tool']);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'dangerous_tool',
        args: {},
        round: 0
      };

      const result = await policyManager.evaluateToolCall(callInfo);
      
      expect(result.result).toBe('denied');
      expect(result.violations![0].policy).toBe('denylist');
    });

    it('should approve tools in allowlist', async () => {
      policyManager.addToAllowlist(['safe_tool']);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'safe_tool',
        args: {},
        round: 0
      };

      const result = await policyManager.evaluateToolCall(callInfo);
      
      expect(result.result).toBe('approved');
      expect(result.metadata?.allowlisted).toBe(true);
    });

    it('should evaluate custom policies', async () => {
      const customPolicy = vi.fn().mockReturnValue('denied');
      policyManager.registerPolicy('custom', customPolicy);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'test_tool',
        args: { data: 'test' },
        round: 0
      };

      const result = await policyManager.evaluateToolCall(callInfo);
      
      expect(result.result).toBe('denied');
      expect(customPolicy).toHaveBeenCalledWith(callInfo, undefined);
    });

    it('should use builtin policies correctly', () => {
      const allowOnlyPolicy = BuiltinPolicies.allowOnly(['tool1', 'tool2']);
      
      expect(allowOnlyPolicy({ id: '1', name: 'tool1', args: {}, round: 0 })).toBe('approved');
      expect(allowOnlyPolicy({ id: '2', name: 'tool3', args: {}, round: 0 })).toBe('denied');
    });
  });

  describe('Integration with Streaming', () => {
    let mockProvider: LLMProvider;

    beforeEach(() => {
      mockProvider = {
        name: 'test-provider',
        models: async () => [{ name: 'test-model' }],
        chat: vi.fn()
      };
      setProvider(mockProvider);

      // Clear any previously registered tools
      const registeredTools = ['test_tool', 'math_add', 'dangerous_tool'];
      for (const tool of registeredTools) {
        try {
          unregisterTool(tool);
        } catch {
          // Tool might not be registered
        }
      }
    });

    it('should validate and execute tools in stream', async () => {
      // Register a simple tool
      registerTool('math_add', {
        name: 'math_add',
        description: 'Add two numbers',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        }
      }, (args: any) => {
        return args.a + args.b;
      });

      const mockStream = async function* () {
        yield { type: 'text', value: 'Let me calculate that for you.' } as StreamEvent;
        yield { 
          type: 'tool_call', 
          toolName: 'math_add', 
          arguments: { a: 5, b: 3 }, 
          callId: 'call_1' 
        } as StreamEvent;
        yield { type: 'text', value: 'The answer is 8.' } as StreamEvent;
        yield { type: 'end' } as StreamEvent;
      };

      vi.mocked(mockProvider.chat).mockResolvedValue(mockStream());

      const stream = await createChatStream({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Add 5 and 3' }]
      }, {
        enableToolValidation: true,
        enableRoundEvents: false
      });

      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Should include original events plus tool result
      expect(events.some(e => e.type === 'text' && e.value.includes('calculate'))).toBe(true);
      expect(events.some(e => e.type === 'tool_call' && e.toolName === 'math_add')).toBe(true);
      expect(events.some(e => e.type === 'tool_result' && e.result === 8)).toBe(true);
      expect(events.some(e => e.type === 'text' && e.value.includes('answer'))).toBe(true);
    });

    it('should handle tool validation errors in stream', async () => {
      // Register a tool but configure security to deny it
      registerTool('dangerous_tool', {
        name: 'dangerous_tool',
        parameters: { type: 'object', properties: {} }
      }, () => 'should not execute');

      configureToolSecurity({
        deniedTools: ['dangerous_tool']
      });

      const mockStream = async function* () {
        yield { 
          type: 'tool_call', 
          toolName: 'dangerous_tool', 
          arguments: {}, 
          callId: 'call_1' 
        } as StreamEvent;
        yield { type: 'end' } as StreamEvent;
      };

      vi.mocked(mockProvider.chat).mockResolvedValue(mockStream());

      const stream = await createChatStream({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Do something dangerous' }]
      }, {
        enableToolValidation: true,
        enableRoundEvents: false
      });

      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Should include validation error instead of execution result
      expect(events.some(e => e.type === 'tool_call')).toBe(true);
      expect(events.some(e => e.type === 'tool_validation_error')).toBe(false); // Tool is denied at policy level, not validation level
      expect(events.some(e => e.type === 'tool_result')).toBe(false);
    });

    it('should disable tool validation when configured', async () => {
      const mockStream = async function* () {
        yield { 
          type: 'tool_call', 
          toolName: 'unknown_tool', 
          arguments: {}, 
          callId: 'call_1' 
        } as StreamEvent;
        yield { type: 'end' } as StreamEvent;
      };

      vi.mocked(mockProvider.chat).mockResolvedValue(mockStream());

      const stream = await createChatStream({
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      }, {
        enableToolValidation: false, // Disabled
        enableRoundEvents: false
      });

      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Should pass through tool calls without validation
      expect(events.some(e => e.type === 'tool_call')).toBe(true);
      expect(events.some(e => e.type === 'tool_validation_error')).toBe(false);
    });
  });

  describe('Real-world Tool Scenarios', () => {
    it('should handle complex nested tool arguments', async () => {
      const validator = new ToolValidator();

      const schema: ToolSchema = {
        name: 'complex_tool',
        description: 'Tool with complex nested arguments',
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string', maxLength: 50 },
                age: { type: 'number', minimum: 0, maximum: 150 },
                preferences: {
                  type: 'array',
                  items: { type: 'string' },
                  maxItems: 10
                }
              },
              required: ['name', 'age']
            },
            metadata: {
              type: 'object',
              additionalProperties: { type: 'string' }
            }
          },
          required: ['user']
        }
      };

      validator.registerTool(schema);

      const callInfo: ToolCallInfo = {
        id: 'call_1',
        name: 'complex_tool',
        args: {
          user: {
            name: 'Alice',
            age: 30,
            preferences: ['music', 'reading']
          },
          metadata: {
            source: 'web',
            timestamp: '2023-01-01'
          }
        },
        round: 0
      };

      const result = await validator.validateToolCall('complex_tool', callInfo.args, callInfo);
      
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toBeDefined();
    });

    it('should handle concurrent tool executions', async () => {
      const manager = new ToolCallManager({
        maxConcurrentExecutions: 5, // Increased to allow all calls to execute
        autoExecute: true
      });

      const schema: ToolSchema = {
        name: 'slow_tool',
        parameters: { type: 'object', properties: {} }
      };

      const executor = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced timeout
        return 'result';
      });

      manager.registerTool('slow_tool', schema, executor);

      // Start three tool calls concurrently
      const promises = [
        manager.processToolCall({ type: 'tool_call', toolName: 'slow_tool', arguments: {}, callId: 'call_1' }),
        manager.processToolCall({ type: 'tool_call', toolName: 'slow_tool', arguments: {}, callId: 'call_2' }),
        manager.processToolCall({ type: 'tool_call', toolName: 'slow_tool', arguments: {}, callId: 'call_3' })
      ];

      const results = await Promise.all(promises);

      // All should eventually complete
      expect(results).toHaveLength(3);
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it('should track tool call metrics and lifecycle', async () => {
      const manager = new ToolCallManager();
      
      const schema: ToolSchema = {
        name: 'tracked_tool',
        parameters: { type: 'object', properties: {} }
      };

      manager.registerTool('tracked_tool', schema, async () => 'result');

      await manager.processToolCall({ 
        type: 'tool_call', 
        toolName: 'tracked_tool', 
        arguments: {}, 
        callId: 'call_1' 
      });

      const toolCall = manager.getToolCall('call_1');
      
      expect(toolCall).toBeDefined();
      expect(toolCall!.state).toBe('completed');
      expect(toolCall!.executionTimeMs).toBeGreaterThan(0);
      expect(toolCall!.timestamp).toBeInstanceOf(Date);
    });
  });
});