import { describe, it, expect, beforeEach, vi } from "vitest";
import { toolRegistry } from "../registry.js";
import type { UnifiedTool } from "../registry.js";

// Mock the tool factories to avoid real dependencies
vi.mock("../Bash.factory.js", () => ({
  createBashTool: vi.fn(() => ({
    name: "Bash",
    description: "execute bash commands",
    parameters: { command: { type: "string" } },
    implementation: vi.fn()
  }))
}));

vi.mock("../Read.factory.js", () => ({
  createReadTool: vi.fn(() => ({
    name: "Read",
    description: "read a file from the filesystem",
    parameters: { absolute_path: { type: "string" } },
    implementation: vi.fn()
  }))
}));

vi.mock("../Write.factory.js", () => ({
  createWriteTool: vi.fn(() => ({
    name: "Write",
    description: "write content to a file",
    parameters: { file_path: { type: "string" }, content: { type: "string" } },
    implementation: vi.fn()
  }))
}));

vi.mock("../Edit.factory.js", () => ({
  createEditTool: vi.fn(() => ({
    name: "Edit",
    description: "Update the contents of a file.",
    parameters: { file_path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } },
    implementation: vi.fn()
  }))
}));

vi.mock("../GraphQuery.js", () => ({
  GraphQuery: {
    name: "GraphQuery",
    description: "Execute graph queries",
    parameters: { query: { type: "string" } },
    implementation: vi.fn()
  }
}));

describe("ToolRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBuiltinTools", () => {
    it("should return all builtin tools", () => {
      const builtinTools = toolRegistry.getBuiltinTools();
      
      expect(builtinTools).toHaveLength(5);
      
      const toolNames = builtinTools.map(tool => tool.name);
      expect(toolNames).toContain("Bash");
      expect(toolNames).toContain("Read");
      expect(toolNames).toContain("Write");
      expect(toolNames).toContain("Edit");
      expect(toolNames).toContain("GraphQuery");
    });

    it("should return tools with correct structure", () => {
      const builtinTools = toolRegistry.getBuiltinTools();
      
      builtinTools.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("source", "builtin");
        expect(tool).toHaveProperty("parameters");
        expect(tool).toHaveProperty("implementation");
        expect(typeof tool.implementation).toBe("function");
      });
    });

    it("should have descriptions for all tools", () => {
      const builtinTools = toolRegistry.getBuiltinTools();
      
      builtinTools.forEach(tool => {
        expect(tool.description).toBeTypeOf("string");
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("ToolRegistryInterface methods", () => {
    it("should register and get tools", () => {
      const mockTool = {
        name: "TestTool",
        description: "A test tool",
        schema: {},
        validate: vi.fn(),
        execute: vi.fn(),
        version: "1.0.0"
      };

      toolRegistry.register(mockTool);
      const retrievedTool = toolRegistry.get("TestTool");
      
      expect(retrievedTool).toBeDefined();
      expect(retrievedTool?.name).toBe("TestTool");
    });

    it("should check if tool exists", () => {
      expect(toolRegistry.has("Read")).toBe(true);
      expect(toolRegistry.has("NonExistentTool")).toBe(false);
    });

    it("should get tool schemas", () => {
      const schemas = toolRegistry.getToolSchemas();
      
      // We expect 5 builtin tools
      expect(schemas.length).toBeGreaterThanOrEqual(5);
      const schemaNames = schemas.map(s => s.name);
      expect(schemaNames).toContain("Read");
      expect(schemaNames).toContain("Write");
      expect(schemaNames).toContain("Edit");
      expect(schemaNames).toContain("Bash");
      expect(schemaNames).toContain("GraphQuery");
      
      // Check that schemas have the right structure
      const readSchema = schemas.find(s => s.name === "Read");
      expect(readSchema).toBeDefined();
      expect(readSchema?.description).toContain("read a file");
    });

    it("should remove tools", () => {
      const mockTool = {
        name: "ToRemove",
        description: "Tool to remove",
        schema: {},
        validate: vi.fn(),
        execute: vi.fn()
      };

      toolRegistry.register(mockTool);
      expect(toolRegistry.has("ToRemove")).toBe(true);
      
      toolRegistry.remove("ToRemove");
      expect(toolRegistry.has("ToRemove")).toBe(false);
    });

    it("should clear all tools", () => {
      // Add a custom tool
      const mockTool = {
        name: "ToClear",
        description: "Tool to clear",
        schema: {},
        validate: vi.fn(),
        execute: vi.fn()
      };

      toolRegistry.register(mockTool);
      expect(toolRegistry.has("ToClear")).toBe(true);
      
      toolRegistry.clear();
      expect(toolRegistry.has("ToClear")).toBe(false);
      // Check that we can still get builtin tools
      const builtinTools = toolRegistry.getBuiltinTools();
      expect(builtinTools.length).toBe(5);
    });
  });

  describe("getAllTools", () => {
    it("should return all tools", () => {
      const allTools = toolRegistry.getAllTools();
      
      expect(allTools.length).toBeGreaterThanOrEqual(5); // All builtin tools
      
      const builtinTools = allTools.filter(tool => tool.source === "builtin");
      expect(builtinTools).toHaveLength(5);
    });
  });

  describe("getTool", () => {
    it("should find builtin tool by name", () => {
      const tool = toolRegistry.getToolByName("Read");
      
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("Read");
      expect(tool!.source).toBe("builtin");
    });

    it("should return undefined for non-existent tool", () => {
      const tool = toolRegistry.getToolByName("NonExistentTool");
      expect(tool).toBeUndefined();
    });
  });

  describe("getLMStudioTools", () => {
    it("should return LMStudio compatible tools", () => {
      const lmStudioTools = toolRegistry.getLMStudioTools();
      
      // Should return the 5 builtin tools
      expect(lmStudioTools.length).toBeGreaterThanOrEqual(5);
      expect(lmStudioTools.every(tool => tool !== null && tool !== undefined)).toBe(true);
    });
  });

  describe("tool parameter extraction", () => {
    it("should handle Zod schemas correctly", () => {
      const builtinTools = toolRegistry.getBuiltinTools();
      const readTool = builtinTools.find(tool => tool.name === "Read");
      
      expect(readTool).toBeDefined();
      expect(readTool!.parameters).toBeDefined();
      expect(typeof readTool!.parameters).toBe("object");
    });

    it("should handle legacy plain object parameters", () => {
      const builtinTools = toolRegistry.getBuiltinTools();
      const graphQueryTool = builtinTools.find(tool => tool.name === "GraphQuery");
      
      expect(graphQueryTool).toBeDefined();
      expect(graphQueryTool!.parameters).toBeDefined();
    });
  });
});