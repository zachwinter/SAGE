import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeTools } from "@sage/test-utils/adapters";

describe("Tools Integration Tests", () => {
  let tools: any;

  beforeEach(() => {
    tools = makeTools();
  });

  describe("Tool Registry", () => {
    it("should register and get tools", () => {
      const toolNames = ["Read", "Write", "Edit", "Bash", "GraphQuery"];
      
      // Test that all standard tools are available
      toolNames.forEach(name => {
        const tool = tools.get(name);
        expect(tool).toBeDefined();
        expect(tool.name).toBe(name);
      });
    });

    it("should get tool schemas", () => {
      const schemas = tools.getToolSchemas();
      
      expect(schemas).toHaveLength(5);
      const schemaNames = schemas.map((s: any) => s.name);
      expect(schemaNames).toContain("Read");
      expect(schemaNames).toContain("Write");
      expect(schemaNames).toContain("Edit");
      expect(schemaNames).toContain("Bash");
      expect(schemaNames).toContain("GraphQuery");
    });

    it("should handle tool execution", async () => {
      const readTool = tools.get("Read");
      
      const result = await readTool.execute(
        { file: "test.txt" },
        { cwd: "/test" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.content).toContain("Mock content");
    });
  });

  describe("Read Tool", () => {
    it("should execute successfully", async () => {
      const readTool = tools.get("Read");
      
      const result = await readTool.execute(
        { file: "src/index.ts" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data.content).toContain("Mock content for src/index.ts");
    });
  });

  describe("Write Tool", () => {
    it("should execute successfully in write mode", async () => {
      const writeTools = makeTools({ readOnly: false });
      const writeTool = writeTools.get("Write");
      
      const result = await writeTool.execute(
        { file: "output.txt", content: "Hello World" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data.bytes).toBe(11);
    });

    it("should fail in read-only mode", async () => {
      const writeTool = tools.get("Write");
      
      const result = await writeTool.execute(
        { file: "output.txt", content: "Hello World" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("EPERMISSION");
    });
  });

  describe("Edit Tool", () => {
    it("should execute successfully in write mode", async () => {
      const editTools = makeTools({ readOnly: false });
      const editTool = editTools.get("Edit");
      
      const result = await editTool.execute(
        { file: "src/index.ts", patch: "patch content", strategy: "apply" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data.patched).toBe(true);
    });

    it("should fail in read-only mode", async () => {
      const editTool = tools.get("Edit");
      
      const result = await editTool.execute(
        { file: "src/index.ts", patch: "patch content", strategy: "apply" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("EPERMISSION");
    });
  });

  describe("Bash Tool", () => {
    it("should execute echo command successfully", async () => {
      const bashTools = makeTools({ readOnly: false });
      const bashTool = bashTools.get("Bash");
      
      const result = await bashTool.execute(
        { command: "echo", args: ["Hello", "World"] },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain("Hello World");
    });

    it("should fail in read-only mode", async () => {
      const bashTool = tools.get("Bash");
      
      const result = await bashTool.execute(
        { command: "echo", args: ["Hello"] },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("EPERMISSION");
    });
  });

  describe("GraphQuery Tool", () => {
    it("should execute successfully", async () => {
      const graphTool = tools.get("GraphQuery");
      
      const result = await graphTool.execute(
        { query: "MATCH (n) RETURN n" },
        { cwd: "/workspace" }
      );
      
      expect(result.ok).toBe(true);
      expect(result.data.rows).toHaveLength(2);
    });
  });
});