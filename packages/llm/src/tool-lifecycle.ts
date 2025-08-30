// src/tool-lifecycle.ts
// Tool call lifecycle management with callId tracking and pairing

import type { StreamEvent, ToolCallInfo, ToolSchema } from './types.js';
import type { ToolValidator, ValidationResult } from './tool-validation.js';
import { AsyncQueue } from './stream-utils.js';

/**
 * Tool call states throughout its lifecycle
 */
export type ToolCallState = 
  | 'pending'      // Tool call received, awaiting validation
  | 'validating'   // Currently being validated
  | 'approved'     // Validation passed, approved for execution
  | 'denied'       // Validation failed or denied by policy
  | 'executing'    // Tool is currently being executed
  | 'completed'    // Tool execution completed successfully
  | 'failed'       // Tool execution failed with error
  | 'timeout'      // Tool execution timed out
  | 'cancelled';   // Tool execution was cancelled

/**
 * Tool call lifecycle entry
 */
export interface ToolCall {
  id: string;
  toolName: string;
  arguments: unknown;
  state: ToolCallState;
  round: number;
  timestamp: Date;
  validationResult?: ValidationResult;
  result?: unknown;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Tool execution function
 */
export type ToolExecutor = (args: unknown, callInfo: ToolCallInfo) => Promise<unknown> | unknown;

/**
 * Tool execution registry
 */
export interface ToolRegistry {
  [toolName: string]: {
    schema: ToolSchema;
    executor: ToolExecutor;
  };
}

/**
 * Tool call lifecycle events
 */
export type ToolLifecycleEvent = 
  | { type: 'tool_call_received'; callId: string; toolName: string; arguments: unknown; round: number }
  | { type: 'tool_call_validated'; callId: string; valid: boolean; errors?: string[] }
  | { type: 'tool_call_approved'; callId: string }
  | { type: 'tool_call_denied'; callId: string; reason: string }
  | { type: 'tool_execution_started'; callId: string }
  | { type: 'tool_execution_completed'; callId: string; result: unknown; executionTimeMs: number }
  | { type: 'tool_execution_failed'; callId: string; error: string; executionTimeMs: number }
  | { type: 'tool_execution_timeout'; callId: string; timeoutMs: number }
  | { type: 'tool_execution_cancelled'; callId: string };

/**
 * Tool call manager options
 */
export interface ToolCallManagerOptions {
  // Maximum execution time for tools
  defaultTimeoutMs?: number;
  // Maximum number of concurrent tool executions
  maxConcurrentExecutions?: number;
  // Whether to auto-execute approved tools
  autoExecute?: boolean;
  // Maximum number of tool calls to track in memory
  maxHistorySize?: number;
}

/**
 * Tool call manager for lifecycle management
 */
export class ToolCallManager {
  private toolCalls = new Map<string, ToolCall>();
  private toolRegistry: ToolRegistry = {};
  private validator?: ToolValidator;
  private lifecycleEvents = new AsyncQueue<ToolLifecycleEvent>();
  private activeExecutions = new Set<string>();
  private options: Required<ToolCallManagerOptions>;

  constructor(options: ToolCallManagerOptions = {}) {
    this.options = {
      defaultTimeoutMs: 30000,
      maxConcurrentExecutions: 5,
      autoExecute: true,
      maxHistorySize: 1000,
      ...options
    };
  }

  /**
   * Set the tool validator
   */
  setValidator(validator: ToolValidator): void {
    this.validator = validator;
  }

  /**
   * Register a tool with its schema and executor
   */
  registerTool(toolName: string, schema: ToolSchema, executor: ToolExecutor): void {
    this.toolRegistry[toolName] = { schema, executor };
    
    // Also register with validator if available
    if (this.validator) {
      this.validator.registerTool(schema);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    delete this.toolRegistry[toolName];
    
    if (this.validator) {
      this.validator.unregisterTool(toolName);
    }
  }

  /**
   * Process a tool call from a stream event
   */
  async processToolCall(event: StreamEvent): Promise<StreamEvent[]> {
    if (event.type !== 'tool_call') {
      return [event];
    }

    const { toolName, arguments: args, callId } = event;
    const results: StreamEvent[] = [event]; // Include original event

    // Create tool call entry
    const toolCall: ToolCall = {
      id: callId,
      toolName,
      arguments: args,
      state: 'pending',
      round: 0, // Will be updated if we have context
      timestamp: new Date()
    };

    this.toolCalls.set(callId, toolCall);
    
    // Emit lifecycle event
    this.lifecycleEvents.push({
      type: 'tool_call_received',
      callId,
      toolName,
      arguments: args,
      round: toolCall.round
    });

    // Validate the tool call
    await this.validateToolCall(callId);
    
    // Auto-execute if enabled and approved
    if (this.options.autoExecute && toolCall.state === 'approved') {
      const executionResults = await this.executeToolCall(callId);
      results.push(...executionResults);
    }

    return results;
  }

  /**
   * Validate a tool call
   */
  async validateToolCall(callId: string): Promise<void> {
    const toolCall = this.toolCalls.get(callId);
    if (!toolCall) return;

    toolCall.state = 'validating';

    try {
      // Check if tool is registered
      const toolInfo = this.toolRegistry[toolCall.toolName];
      if (!toolInfo) {
        toolCall.state = 'denied';
        toolCall.error = `Tool '${toolCall.toolName}' is not registered`;
        
        this.lifecycleEvents.push({
          type: 'tool_call_denied',
          callId,
          reason: toolCall.error
        });
        return;
      }

      // Validate with validator if available
      if (this.validator) {
        const callInfo: ToolCallInfo = {
          id: callId,
          name: toolCall.toolName,
          args: toolCall.arguments,
          round: toolCall.round
        };

        const validationResult = await this.validator.validateToolCall(
          toolCall.toolName,
          toolCall.arguments,
          callInfo
        );

        toolCall.validationResult = validationResult;

        this.lifecycleEvents.push({
          type: 'tool_call_validated',
          callId,
          valid: validationResult.valid,
          errors: validationResult.errors?.map(e => e.message)
        });

        if (validationResult.valid) {
          toolCall.state = 'approved';
          toolCall.arguments = validationResult.sanitizedArgs || toolCall.arguments;
          
          this.lifecycleEvents.push({
            type: 'tool_call_approved',
            callId
          });
        } else {
          toolCall.state = 'denied';
          toolCall.error = validationResult.errors?.[0]?.message || 'Validation failed';
          
          this.lifecycleEvents.push({
            type: 'tool_call_denied',
            callId,
            reason: toolCall.error
          });
        }
      } else {
        // No validator, auto-approve
        toolCall.state = 'approved';
        
        this.lifecycleEvents.push({
          type: 'tool_call_approved',
          callId
        });
      }
    } catch (error) {
      toolCall.state = 'denied';
      toolCall.error = `Validation error: ${error instanceof Error ? error.message : String(error)}`;
      
      this.lifecycleEvents.push({
        type: 'tool_call_denied',
        callId,
        reason: toolCall.error
      });
    }
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(callId: string): Promise<StreamEvent[]> {
    const toolCall = this.toolCalls.get(callId);
    if (!toolCall || toolCall.state !== 'approved') {
      return [];
    }

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.options.maxConcurrentExecutions) {
      return [{
        type: 'tool_validation_error',
        callId,
        error: 'Too many concurrent tool executions',
        toolName: toolCall.toolName
      }];
    }

    const toolInfo = this.toolRegistry[toolCall.toolName];
    if (!toolInfo) {
      return [{
        type: 'tool_validation_error',
        callId,
        error: `Tool '${toolCall.toolName}' not found`,
        toolName: toolCall.toolName
      }];
    }

    toolCall.state = 'executing';
    this.activeExecutions.add(callId);
    
    const startTime = Date.now();
    
    this.lifecycleEvents.push({
      type: 'tool_execution_started',
      callId
    });

    try {
      // Create execution promise with timeout
      const executionPromise = Promise.resolve(
        toolInfo.executor(toolCall.arguments, {
          id: callId,
          name: toolCall.toolName,
          args: toolCall.arguments,
          round: toolCall.round
        })
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), this.options.defaultTimeoutMs);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      toolCall.state = 'completed';
      toolCall.result = result;
      toolCall.executionTimeMs = Math.max(executionTime, 1); // Ensure non-zero execution time

      this.lifecycleEvents.push({
        type: 'tool_execution_completed',
        callId,
        result,
        executionTimeMs: executionTime
      });

      return [{
        type: 'tool_result',
        callId,
        result
      }];

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('timeout')) {
        toolCall.state = 'timeout';
        
        this.lifecycleEvents.push({
          type: 'tool_execution_timeout',
          callId,
          timeoutMs: this.options.defaultTimeoutMs
        });
      } else {
        toolCall.state = 'failed';
        toolCall.error = errorMessage;
        toolCall.executionTimeMs = executionTime;

        this.lifecycleEvents.push({
          type: 'tool_execution_failed',
          callId,
          error: errorMessage,
          executionTimeMs: executionTime
        });
      }

      return [{
        type: 'tool_validation_error',
        callId,
        error: errorMessage,
        toolName: toolCall.toolName
      }];

    } finally {
      this.activeExecutions.delete(callId);
      this.cleanupOldToolCalls();
    }
  }

  /**
   * Cancel a tool call execution
   */
  async cancelToolCall(callId: string): Promise<boolean> {
    const toolCall = this.toolCalls.get(callId);
    if (!toolCall || toolCall.state !== 'executing') {
      return false;
    }

    toolCall.state = 'cancelled';
    this.activeExecutions.delete(callId);

    this.lifecycleEvents.push({
      type: 'tool_execution_cancelled',
      callId
    });

    return true;
  }

  /**
   * Get tool call status
   */
  getToolCall(callId: string): ToolCall | undefined {
    return this.toolCalls.get(callId);
  }

  /**
   * Get all tool calls
   */
  getAllToolCalls(): ToolCall[] {
    return Array.from(this.toolCalls.values());
  }

  /**
   * Get tool calls by state
   */
  getToolCallsByState(state: ToolCallState): ToolCall[] {
    return this.getAllToolCalls().filter(call => call.state === state);
  }

  /**
   * Get lifecycle events stream
   */
  getLifecycleEvents(): AsyncIterable<ToolLifecycleEvent> {
    return this.lifecycleEvents;
  }

  /**
   * Get registered tools
   */
  getRegisteredTools(): string[] {
    return Object.keys(this.toolRegistry);
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistry {
    return { ...this.toolRegistry };
  }

  /**
   * Clear all tool calls (for testing/cleanup)
   */
  clearToolCalls(): void {
    this.toolCalls.clear();
    this.activeExecutions.clear();
  }

  /**
   * Clean up old tool calls to prevent memory leaks
   */
  private cleanupOldToolCalls(): void {
    if (this.toolCalls.size <= this.options.maxHistorySize) {
      return;
    }

    // Sort by timestamp and keep only the most recent ones
    const sortedCalls = Array.from(this.toolCalls.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    const toKeep = sortedCalls.slice(0, this.options.maxHistorySize);
    
    this.toolCalls.clear();
    for (const [id, call] of toKeep) {
      this.toolCalls.set(id, call);
    }
  }
}

/**
 * Generate a unique call ID
 */
export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default global tool call manager
 */
export const defaultToolCallManager = new ToolCallManager();