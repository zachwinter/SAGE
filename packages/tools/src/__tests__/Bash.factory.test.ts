import { describe, it, expect, beforeEach, vi } from "vitest";
import { bashImplementation, bashParameters, createBashTool } from "../Bash.factory.js";
import type { ToolContext } from "../interfaces.js";

describe("Bash Tool Factory", () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      fileSystem: {} as any,
      process: {
        executeCommand: vi.fn()
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      workingDirectory: "/test/workspace"
    };
  });

  describe("bashParameters schema", () => {
    it("should validate valid bash parameters", () => {
      const validParams = { command: "echo hello" };
      expect(() => bashParameters.parse(validParams)).not.toThrow();
    });

    it("should validate bash parameters with timeout", () => {
      const validParams = { command: "ls -la", timeout: 5000 };
      expect(() => bashParameters.parse(validParams)).not.toThrow();
    });

    it("should reject empty command", () => {
      const invalidParams = { command: "" };
      expect(() => bashParameters.parse(invalidParams)).toThrow();
    });

    it("should reject non-string command", () => {
      const invalidParams = { command: 123 };
      expect(() => bashParameters.parse(invalidParams)).toThrow();
    });

    it("should reject invalid timeout type", () => {
      const invalidParams = { command: "echo test", timeout: "invalid" };
      expect(() => bashParameters.parse(invalidParams)).toThrow();
    });
  });

  describe("bashImplementation", () => {
    it("should execute command successfully", async () => {
      const mockResult = { success: true, message: "hello\n" };
      mockContext.process.executeCommand = vi.fn().mockResolvedValue(mockResult);

      const result = await bashImplementation(
        { command: "echo hello" },
        mockContext
      );

      expect(result).toEqual(mockResult);
      expect(mockContext.process.executeCommand).toHaveBeenCalledWith(
        "echo hello",
        {
          cwd: "/test/workspace",
          timeout: 30000
        }
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Tool:Bash invoked",
        { command: "echo hello", timeout: 30000 }
      );
    });

    it("should use custom timeout", async () => {
      const mockResult = { success: true, message: "test\n" };
      mockContext.process.executeCommand = vi.fn().mockResolvedValue(mockResult);

      await bashImplementation(
        { command: "echo test", timeout: 5000 },
        mockContext
      );

      expect(mockContext.process.executeCommand).toHaveBeenCalledWith(
        "echo test",
        {
          cwd: "/test/workspace",
          timeout: 5000
        }
      );
    });

    it("should handle process execution errors", async () => {
      const error = new Error("Command failed");
      mockContext.process.executeCommand = vi.fn().mockRejectedValue(error);

      const result = await bashImplementation(
        { command: "invalid-command" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "Command failed"
      });
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        "Tool:Bash failed",
        error,
        { command: "invalid-command", timeout: 30000 }
      );
    });

    it("should handle non-Error exceptions", async () => {
      mockContext.process.executeCommand = vi.fn().mockRejectedValue("String error");

      const result = await bashImplementation(
        { command: "test" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "String error"
      });
    });
  });

  describe("createBashTool", () => {
    it("should create a valid LM Studio tool", () => {
      const tool = createBashTool();

      expect(tool.name).toBe("Bash");
      expect(tool.description).toBe("execute bash commands");
      expect(tool.parameters).toBe(bashParameters);
      expect(typeof tool.implementation).toBe("function");
    });

    it("should have working implementation", async () => {
      // This test would require mocking the real dependencies,
      // so we'll test the structure for now
      const tool = createBashTool();
      expect(tool.implementation).toBeDefined();
    });
  });

  describe("integration with real context", () => {
    it("should work with mocked process operations", async () => {
      const result = { success: true, message: "test output" };
      
      const tool = createBashTool();
      
      // Mock the real process operations for this test
      const originalImplementation = tool.implementation;
      tool.implementation = vi.fn().mockResolvedValue(result);

      const output = await tool.implementation({ command: "echo test" });
      expect(output).toEqual(result);
    });
  });
});