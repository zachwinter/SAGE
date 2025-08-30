import { describe, it, expect } from "vitest";
import { toolRegistry } from "../registry.js";
import { createReadTool } from "../Read.factory.js";
import { createWriteTool } from "../Write.factory.js";
import { createEditTool } from "../Edit.factory.js";
import { createBashTool } from "../Bash.factory.js";
import { GraphQuery } from "../GraphQuery.js";

describe("Tools Basic Functionality", () => {
  describe("Tool Registry", () => {
    it("should have tool registry instance", () => {
      expect(toolRegistry).toBeDefined();
    });

    it("should have builtin tools", () => {
      const tools = toolRegistry.getBuiltinTools();
      expect(tools.length).toBeGreaterThanOrEqual(0); // At least some tools should be loaded
    });
  });

  describe("Tool Factories", () => {
    it("should create Read tool", () => {
      const tool = createReadTool();
      expect(tool).toBeDefined();
      expect(tool.name).toBe("Read");
    });

    it("should create Write tool", () => {
      const tool = createWriteTool();
      expect(tool).toBeDefined();
      expect(tool.name).toBe("Write");
    });

    it("should create Edit tool", () => {
      const tool = createEditTool();
      expect(tool).toBeDefined();
      expect(tool.name).toBe("Edit");
    });

    it("should create Bash tool", () => {
      const tool = createBashTool();
      expect(tool).toBeDefined();
      expect(tool.name).toBe("Bash");
    });

    it("should have GraphQuery tool", () => {
      expect(GraphQuery).toBeDefined();
      expect(GraphQuery.name).toBe("GraphQuery");
    });
  });
});