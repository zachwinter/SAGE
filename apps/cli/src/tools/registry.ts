import { tool as lmStudioTool } from "@lmstudio/sdk";
import type { FC } from "react";
import { z } from "zod";
import { getAvailableMcpTools, mcpClientManager } from "../mcp";

import { Bash } from "./Bash.js";
import { Edit } from "./Edit.js";
import { GraphQuery } from "./GraphQuery";
import { Read } from "./Read.js";
import { BashRenderer } from "./renderers/BashRenderer.js";
import { EditRenderer } from "./renderers/EditRenderer.js";
import { GraphQueryRenderer } from "./renderers/GraphQueryRenderer.js";
import { ReadRenderer } from "./renderers/ReadRenderer.js";
import { WriteRenderer } from "./renderers/WriteRenderer.js";
import { Write } from "./Write.js";

export type ToolSource = "builtin" | "mcp";
export interface ToolRendererProps {
  args: Record<string, any>;
  hasError?: boolean;
  errorMessage?: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  source: ToolSource;
  serverId?: string;
  serverName?: string;
  parameters?: Record<string, any>;
  implementation: (args: any) => Promise<any>;
  Renderer?: FC<ToolRendererProps>;
}

class ToolRegistry {
  private builtinTools: Map<string, any> = new Map();

  constructor() {
    // Register built-in tools
    this.builtinTools.set("Bash", Bash);
    this.builtinTools.set("Edit", Edit);
    this.builtinTools.set("Read", Read);
    this.builtinTools.set("Write", Write);
    this.builtinTools.set("GraphQuery", GraphQuery);
  }

  getBuiltinTools(): UnifiedTool[] {
    const rendererMap: Record<string, FC<ToolRendererProps>> = {
      Bash: BashRenderer,
      Edit: EditRenderer,
      Read: ReadRenderer,
      Write: WriteRenderer,
      GraphQuery: GraphQueryRenderer
    };

    return Array.from(this.builtinTools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description || `Built-in ${name} tool`,
      source: "builtin" as const,
      parameters: tool.parameters || {},
      implementation: tool.implementation,
      Renderer: rendererMap[name]
    }));
  }

  getMcpTools(): UnifiedTool[] {
    const mcpTools = getAvailableMcpTools();
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || `Tool from ${tool.serverName}`,
      source: "mcp" as const,
      serverId: tool.serverId,
      serverName: tool.serverName,
      parameters: tool.inputSchema || {},
      implementation: async (args: any) => {
        return await mcpClientManager.callTool(tool.serverId, tool.name, args);
      }
    }));
  }

  getAllTools(): UnifiedTool[] {
    return [...this.getBuiltinTools(), ...this.getMcpTools()];
  }

  getTool(name: string): UnifiedTool | undefined {
    const allTools = this.getAllTools();
    return allTools.find(tool => tool.name === name);
  }

  // Convert unified tools to LMStudio format for the agent
  getLMStudioTools(): any[] {
    const unifiedTools = this.getAllTools();

    return unifiedTools
      .map(unifiedTool => {
        if (unifiedTool.source === "builtin") {
          // Return the original LMStudio tool
          return this.builtinTools.get(unifiedTool.name);
        } else {
          // Create LMStudio tool wrapper for MCP tools
          return lmStudioTool({
            name: unifiedTool.name,
            description: unifiedTool.description,
            parameters: this.convertMcpSchemaToZod(unifiedTool.parameters),
            implementation: unifiedTool.implementation
          });
        }
      })
      .filter(Boolean);
  }

  private convertMcpSchemaToZod(schema: any): Record<string, any> {
    if (!schema || typeof schema !== "object") {
      return {};
    }

    const zodSchema: Record<string, any> = {};

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties as any)) {
        const propSchema = prop as any;
        let zodType: any;

        switch (propSchema.type) {
          case "string":
            zodType = z.string();
            break;
          case "number":
            zodType = z.number();
            break;
          case "integer":
            zodType = z.number().int();
            break;
          case "boolean":
            zodType = z.boolean();
            break;
          case "array":
            zodType = z.array(z.any());
            break;
          case "object":
            zodType = z.object({});
            break;
          default:
            zodType = z.any();
        }

        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }

        if (schema.required && !schema.required.includes(key)) {
          zodType = zodType.optional();
        }

        zodSchema[key] = zodType;
      }
    }

    return zodSchema;
  }
}

export const toolRegistry = new ToolRegistry();
