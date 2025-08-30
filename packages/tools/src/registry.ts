import type { FC } from "react";
import { createBashTool } from "./Bash.factory.js";
import { createReadTool } from "./Read.factory.js";
import { createWriteTool } from "./Write.factory.js";
import { createEditTool } from "./Edit.factory.js";
import { GraphQuery } from "./GraphQuery.js";
import { z } from "zod";

export type ToolSource = "builtin";
export interface ToolRendererProps {
  args: Record<string, any>;
  hasError?: boolean;
  errorMessage?: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  source: ToolSource;
  parameters?: Record<string, any>;
  implementation: (args: any) => Promise<any>;
  Renderer?: FC<ToolRendererProps>;
}

// Updated Tool interface to match contract
export interface Tool<I = any, O = any> {
  name: string;
  description?: string;
  schema: Record<string, any>; // JSON Schema
  validate(input: unknown): I; // Zod runtime validation
  execute(input: I, ctx: any): Promise<any>;
  version?: string;
}

export interface ToolRegistryInterface {
  /**
   * Register a tool in the registry
   */
  register(tool: Tool<any, any>): void;

  /**
   * Get a tool by name
   */
  get(name: string): Tool<any, any> | undefined;

  /**
   * Get all tool schemas for LLM tool-calling
   */
  getToolSchemas(): Array<{ name: string; parameters: any; description?: string }>;

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean;

  /**
   * Remove a tool from the registry
   */
  remove(name: string): void;

  /**
   * Clear all tools from the registry
   */
  clear(): void;
}

class ToolRegistry implements ToolRegistryInterface {
  private builtinTools: Map<string, any> = new Map();
  private unifiedTools: Map<string, UnifiedTool> = new Map();

  constructor() {
    // Register built-in tools using the new factory pattern
    this.builtinTools.set("Bash", createBashTool());
    this.builtinTools.set("Read", createReadTool());
    this.builtinTools.set("Write", createWriteTool());
    this.builtinTools.set("Edit", createEditTool());

    // Keep existing tools for backward compatibility
    this.builtinTools.set("GraphQuery", GraphQuery);
  }

  /**
   * Register a tool in the registry
   */
  register(tool: Tool<any, any>): void {
    // For LM Studio tools, we store them directly
    this.builtinTools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool<any, any> | undefined {
    return this.builtinTools.get(name);
  }

  /**
   * Get all tool schemas for LLM tool-calling
   */
  getToolSchemas(): Array<{ name: string; parameters: any; description?: string }> {
    const tools = this.getBuiltinTools();
    return tools.map(tool => ({
      name: tool.name,
      parameters: tool.parameters || {},
      description: tool.description
    }));
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.builtinTools.has(name);
  }

  /**
   * Remove a tool from the registry
   */
  remove(name: string): void {
    this.builtinTools.delete(name);
    this.unifiedTools.delete(name);
  }

  /**
   * Clear all tools from the registry
   */
  clear(): void {
    this.builtinTools.clear();
    this.unifiedTools.clear();
  }

  getBuiltinTools(): UnifiedTool[] {
    const rendererMap: Record<string, FC<ToolRendererProps>> = {};

    return Array.from(this.builtinTools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description || `Built-in ${name} tool`,
      source: "builtin" as const,
      parameters: tool.parameters ? this.getZodSchemaShape(tool.parameters) : {},
      implementation: tool.implementation,
      Renderer: rendererMap[name]
    }));
  }

  // Helper to extract shape from ZodObject
  private getZodSchemaShape(schema: any): Record<string, any> {
    // Handle Zod schemas
    if (schema && typeof schema === 'object') {
      // Check if it's a Zod schema with _def
      if ('_def' in schema) {
        // It's a ZodObject, extract the shape
        if (schema._def.typeName === 'ZodObject' && schema._def.shape) {
          const shape = typeof schema._def.shape === 'function' ? schema._def.shape() : schema._def.shape;
          const result: Record<string, any> = {};
          for (const [key, value] of Object.entries(shape)) {
            // Extract type information from Zod schema
            if (typeof value === 'object' && value !== null && '_def' in value) {
              const def = (value as any)._def;
              if (def.typeName) {
                result[key] = { type: this.getZodTypeName(def.typeName) };
              }
            } else {
              result[key] = { type: typeof value };
            }
          }
          return result;
        }
      }
      // Handle plain objects
      else if (!('_def' in schema)) {
        return schema;
      }
    }
    return schema || {};
  }

  private getZodTypeName(typeName: string): string {
    const typeMap: Record<string, string> = {
      'ZodString': 'string',
      'ZodNumber': 'number',
      'ZodBoolean': 'boolean',
      'ZodArray': 'array',
      'ZodObject': 'object'
    };
    return typeMap[typeName] || typeName.toLowerCase().replace('zod', '');
  }

  getAllTools(): UnifiedTool[] {
    return this.getBuiltinTools();
  }

  getToolByName(name: string): UnifiedTool | undefined {
    const allTools = this.getAllTools();
    return allTools.find(tool => tool.name === name);
  }

  // Convert unified tools to LMStudio format for the agent
  getLMStudioTools(): any[] {
    const unifiedTools = this.getAllTools();

    return unifiedTools
      .map(unifiedTool => {
        // Return the original LMStudio tool
        return this.builtinTools.get(unifiedTool.name);
      })
      .filter(Boolean);
  }

}

export const toolRegistry = new ToolRegistry();
