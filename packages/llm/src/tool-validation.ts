// src/tool-validation.ts
// JSON Schema validation infrastructure for tool arguments

import Ajv, { type JSONSchemaType, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ToolSchema, ToolCallInfo } from './types.js';

/**
 * Tool validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  sanitizedArgs?: unknown;
}

/**
 * Validation error with context
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

/**
 * Tool validation options
 */
export interface ValidationOptions {
  // Remove additional properties not defined in schema
  removeAdditional?: boolean;
  // Use defaults from schema
  useDefaults?: boolean;
  // Allow coercion of types (e.g., string "123" -> number 123)
  coerceTypes?: boolean;
  // Maximum depth for object validation
  maxDepth?: number;
}

/**
 * Tool call approval policy
 */
export type ToolApprovalPolicy = (info: ToolCallInfo) => Promise<'approved' | 'denied'> | 'approved' | 'denied';

/**
 * Tool validator class for JSON Schema validation
 */
export class ToolValidator {
  private ajv: Ajv;
  private compiledSchemas = new Map<string, (data: unknown) => boolean>();
  private approvalPolicy?: ToolApprovalPolicy;

  constructor(options: ValidationOptions = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      removeAdditional: options.removeAdditional ?? true,
      useDefaults: options.useDefaults ?? true,
      coerceTypes: options.coerceTypes ?? true,
      strict: false, // Allow additional JSON Schema features
      validateFormats: true
    });

    // Add format validators (date, email, uri, etc.)
    addFormats(this.ajv);

    // Add custom keywords for better validation
    this.addCustomKeywords();
  }

  /**
   * Set the tool approval policy
   */
  setApprovalPolicy(policy: ToolApprovalPolicy): void {
    this.approvalPolicy = policy;
  }

  /**
   * Register a tool schema for validation
   */
  registerTool(tool: ToolSchema): void {
    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error(`Tool '${tool.name}' must have a parameters object with JSON Schema`);
    }

    try {
      const validator = this.ajv.compile(tool.parameters);
      this.compiledSchemas.set(tool.name, validator);
    } catch (error) {
      throw new Error(`Invalid JSON Schema for tool '${tool.name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate tool call arguments
   */
  async validateToolCall(toolName: string, args: unknown, callInfo: ToolCallInfo): Promise<ValidationResult> {
    // Check if tool is registered
    const validator = this.compiledSchemas.get(toolName);
    if (!validator) {
      return {
        valid: false,
        errors: [{
          field: 'tool',
          message: `Tool '${toolName}' is not registered`,
          code: 'TOOL_NOT_FOUND'
        }]
      };
    }

    // Apply approval policy if configured
    if (this.approvalPolicy) {
      try {
        const approval = await this.approvalPolicy(callInfo);
        if (approval === 'denied') {
          return {
            valid: false,
            errors: [{
              field: 'policy',
              message: `Tool call denied by security policy`,
              code: 'TOOL_DENIED'
            }]
          };
        }
      } catch (error) {
        return {
          valid: false,
          errors: [{
            field: 'policy',
            message: `Policy check failed: ${error instanceof Error ? error.message : String(error)}`,
            code: 'POLICY_ERROR'
          }]
        };
      }
    }

    // Create a deep copy for validation (ajv modifies the object)
    const argsCopy = this.deepClone(args);

    // Validate against JSON Schema
    const isValid = validator(argsCopy);

    if (isValid) {
      return {
        valid: true,
        sanitizedArgs: argsCopy
      };
    }

    // Convert AJV errors to our format
    const errors = this.convertAjvErrors(validator.errors || []);
    
    return {
      valid: false,
      errors,
      sanitizedArgs: argsCopy // Even invalid args might be partially sanitized
    };
  }

  /**
   * Validate multiple tool calls in batch
   */
  async validateToolCalls(calls: Array<{ toolName: string; args: unknown; callInfo: ToolCallInfo }>): Promise<ValidationResult[]> {
    return Promise.all(
      calls.map(({ toolName, args, callInfo }) => 
        this.validateToolCall(toolName, args, callInfo)
      )
    );
  }

  /**
   * Get registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.compiledSchemas.keys());
  }

  /**
   * Check if a tool is registered
   */
  isToolRegistered(toolName: string): boolean {
    return this.compiledSchemas.has(toolName);
  }

  /**
   * Remove a tool from the registry
   */
  unregisterTool(toolName: string): boolean {
    return this.compiledSchemas.delete(toolName);
  }

  /**
   * Clear all registered tools
   */
  clearTools(): void {
    this.compiledSchemas.clear();
  }

  /**
   * Add custom AJV keywords for enhanced validation
   */
  private addCustomKeywords(): void {
    // Add custom keyword for maximum array/object depth
    this.ajv.addKeyword({
      keyword: 'maxDepth',
      type: ['object', 'array'],
      schemaType: 'number',
      compile: (schemaVal: number) => {
        return function validate(data: unknown): boolean {
          return this.getDepth(data) <= schemaVal;
        };
      }
    });

    // Add custom keyword for safe strings (no scripts, etc.)
    this.ajv.addKeyword({
      keyword: 'safeString',
      type: 'string',
      schemaType: 'boolean',
      compile: (schemaVal: boolean) => {
        if (!schemaVal) return () => true;
        
        return function validate(data: string): boolean {
          // Check for potentially dangerous patterns
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /eval\s*\(/i,
            /function\s*\(/i
          ];
          
          return !dangerousPatterns.some(pattern => pattern.test(data));
        };
      }
    });
  }

  /**
   * Deep clone an object for validation
   */
  private deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    if (typeof obj === 'object') {
      const cloned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        cloned[key] = this.deepClone(value);
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Get the depth of a nested object/array
   */
  private getDepth(obj: unknown, currentDepth = 0): number {
    if (obj === null || typeof obj !== 'object') {
      return currentDepth;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return currentDepth + 1;
      return Math.max(
        ...obj.map(item => this.getDepth(item, currentDepth + 1))
      );
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return currentDepth + 1;
    
    return Math.max(
      ...keys.map(key => this.getDepth((obj as Record<string, unknown>)[key], currentDepth + 1))
    );
  }

  /**
   * Convert AJV errors to our ValidationError format
   */
  private convertAjvErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map(error => {
      const field = error.instancePath || error.schemaPath || 'unknown';
      let message = error.message || 'Validation failed';
      
      // Enhance error messages
      if (error.keyword === 'required') {
        message = `Missing required property: ${error.params?.missingProperty}`;
      } else if (error.keyword === 'type') {
        message = `Expected ${error.params?.type} but got ${typeof error.data}`;
      } else if (error.keyword === 'enum') {
        message = `Value must be one of: ${error.params?.allowedValues?.join(', ')}`;
      }

      return {
        field: field.replace(/^\//, ''), // Remove leading slash
        message,
        value: error.data,
        code: error.keyword?.toUpperCase()
      };
    });
  }
}

/**
 * Default global tool validator instance
 */
export const defaultToolValidator = new ToolValidator();

/**
 * Helper function to create a tool validator with common security settings
 */
export function createSecureToolValidator(options: ValidationOptions = {}): ToolValidator {
  return new ToolValidator({
    removeAdditional: true,
    useDefaults: true,
    coerceTypes: false, // More strict for security
    maxDepth: 10,
    ...options
  });
}

/**
 * Common tool schemas for basic types
 */
export const CommonToolSchemas = {
  /**
   * Schema for string parameter
   */
  string: (description?: string, maxLength = 1000): JSONSchemaType<string> => ({
    type: 'string',
    description,
    maxLength,
    safeString: true
  }),

  /**
   * Schema for number parameter
   */
  number: (description?: string, min?: number, max?: number): JSONSchemaType<number> => ({
    type: 'number',
    description,
    minimum: min,
    maximum: max
  }),

  /**
   * Schema for boolean parameter
   */
  boolean: (description?: string): JSONSchemaType<boolean> => ({
    type: 'boolean',
    description
  }),

  /**
   * Schema for array parameter
   */
  array: <T>(itemSchema: JSONSchemaType<T>, description?: string, maxItems = 100): JSONSchemaType<T[]> => ({
    type: 'array',
    items: itemSchema,
    description,
    maxItems
  }),

  /**
   * Schema for object parameter
   */
  object: <T extends Record<string, unknown>>(
    properties: Record<keyof T, JSONSchemaType<T[keyof T]>>, 
    required: (keyof T)[], 
    description?: string
  ): JSONSchemaType<T> => ({
    type: 'object',
    properties,
    required,
    description,
    additionalProperties: false,
    maxDepth: 5
  })
} as const;