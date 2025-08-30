import { describe, it, expect, beforeEach, vi } from "vitest";
import { readImplementation, readParameters, createReadTool } from "../Read.factory.js";
import type { ToolContext } from "../interfaces.js";

describe("Read Tool Factory", () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      fileSystem: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        rm: vi.fn()
      },
      process: {} as any,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      workingDirectory: "/test/workspace"
    };
  });

  describe("readParameters schema", () => {
    it("should validate valid read parameters", () => {
      const validParams = { absolute_path: "/path/to/file.js" };
      expect(() => readParameters.parse(validParams)).not.toThrow();
    });

    it("should validate relative paths", () => {
      const validParams = { absolute_path: "src/file.js" };
      expect(() => readParameters.parse(validParams)).not.toThrow();
    });

    it("should reject empty path", () => {
      const invalidParams = { absolute_path: "" };
      expect(() => readParameters.parse(invalidParams)).toThrow();
    });

    it("should reject non-string path", () => {
      const invalidParams = { absolute_path: 123 };
      expect(() => readParameters.parse(invalidParams)).toThrow();
    });

    it("should require absolute_path parameter", () => {
      const invalidParams = {};
      expect(() => readParameters.parse(invalidParams)).toThrow();
    });
  });

  describe("readImplementation", () => {
    it("should read absolute path successfully", async () => {
      const mockContent = "export default function test() {}";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(mockContent);

      const result = await readImplementation(
        { absolute_path: "/absolute/path/file.js" },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        content: mockContent
      });
      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith("/absolute/path/file.js");
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Tool:Read invoked",
        { absolute_path: "/absolute/path/file.js" }
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Tool:Read success",
        { absolute_path: "/absolute/path/file.js", bytes: mockContent.length }
      );
    });

    it("should resolve relative path correctly", async () => {
      const mockContent = "console.log('hello');";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(mockContent);

      const result = await readImplementation(
        { absolute_path: "src/index.js" },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        content: mockContent
      });
      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith(
        "/test/workspace/src/index.js"
      );
    });

    it("should handle file not found error", async () => {
      const error = new Error("ENOENT: no such file or directory");
      mockContext.fileSystem.readFile = vi.fn().mockRejectedValue(error);

      const result = await readImplementation(
        { absolute_path: "nonexistent.js" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "ENOENT: no such file or directory"
      });
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        "Tool:Read failed",
        error,
        { absolute_path: "nonexistent.js" }
      );
    });

    it("should handle permission error", async () => {
      const error = new Error("EACCES: permission denied");
      mockContext.fileSystem.readFile = vi.fn().mockRejectedValue(error);

      const result = await readImplementation(
        { absolute_path: "/protected/file.js" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "EACCES: permission denied"
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockContext.fileSystem.readFile = vi.fn().mockRejectedValue("String error");

      const result = await readImplementation(
        { absolute_path: "test.js" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "String error"
      });
    });

    it("should handle empty file content", async () => {
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue("");

      const result = await readImplementation(
        { absolute_path: "empty.js" },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        content: ""
      });
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Tool:Read success",
        { absolute_path: "empty.js", bytes: 0 }
      );
    });
  });

  describe("createReadTool", () => {
    it("should create a valid LM Studio tool", () => {
      const tool = createReadTool();

      expect(tool.name).toBe("Read");
      expect(tool.description).toBe("read a file from the filesystem");
      expect(tool.parameters).toBe(readParameters);
      expect(typeof tool.implementation).toBe("function");
    });

    it("should have working implementation", async () => {
      const tool = createReadTool();
      expect(tool.implementation).toBeDefined();
    });
  });

  describe("path resolution edge cases", () => {
    it("should handle paths with '..' correctly", async () => {
      const mockContent = "test content";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(mockContent);

      await readImplementation(
        { absolute_path: "../parent/file.js" },
        mockContext
      );

      // Should resolve relative to working directory
      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith(
        "/test/parent/file.js"
      );
    });

    it("should handle paths with '.' correctly", async () => {
      const mockContent = "test content";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(mockContent);

      await readImplementation(
        { absolute_path: "./current/file.js" },
        mockContext
      );

      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith(
        "/test/workspace/current/file.js"
      );
    });

    it("should not modify absolute paths", async () => {
      const mockContent = "test content";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(mockContent);

      await readImplementation(
        { absolute_path: "/absolute/path/file.js" },
        mockContext
      );

      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith(
        "/absolute/path/file.js"
      );
    });
  });
});