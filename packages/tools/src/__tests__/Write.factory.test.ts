import { describe, it, expect, beforeEach, vi } from "vitest";
import { writeImplementation, writeParameters, createWriteTool } from "../Write.factory.js";
import type { ToolContext } from "../interfaces.js";

describe("Write Tool Factory", () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      fileSystem: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn().mockResolvedValue(true),
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

  describe("writeParameters schema", () => {
    it("should validate valid write parameters with string content", () => {
      const validParams = {
        file_path: "/path/to/file.js",
        content: "console.log('hello');"
      };
      expect(() => writeParameters.parse(validParams)).not.toThrow();
    });

    it("should validate valid write parameters with object content", () => {
      const validParams = {
        file_path: "/path/to/config.json",
        content: { name: "test", version: "1.0.0" }
      };
      expect(() => writeParameters.parse(validParams)).not.toThrow();
    });

    it("should reject empty file_path", () => {
      const invalidParams = { file_path: "", content: "test" };
      expect(() => writeParameters.parse(invalidParams)).toThrow();
    });

    it("should reject non-string file_path", () => {
      const invalidParams = { file_path: 123, content: "test" };
      expect(() => writeParameters.parse(invalidParams)).toThrow();
    });

    it("should require both file_path and content", () => {
      const invalidParams = { file_path: "/path/test.js" };
      expect(() => writeParameters.parse(invalidParams)).toThrow();
    });
  });

  describe("writeImplementation", () => {
    it("should write string content to absolute path successfully", async () => {
      const content = "export default function test() {}";
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      const result = await writeImplementation(
        { file_path: "/absolute/path/file.js", content },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        message: "Successfully wrote to /absolute/path/file.js"
      });
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/absolute/path/file.js",
        content
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Tool:Write success",
        { file_path: "/absolute/path/file.js", bytes: content.length }
      );
    });

    it("should write to relative path successfully", async () => {
      const content = "console.log('hello');";
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      const result = await writeImplementation(
        { file_path: "src/index.js", content },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        message: "Successfully wrote to src/index.js"
      });
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/src/index.js",
        content
      );
    });

    it("should handle JSON object content", async () => {
      const content = { name: "test", version: "1.0.0" };
      const expectedStringContent = JSON.stringify(content, null, 2);
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      const result = await writeImplementation(
        { file_path: "package.json", content },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        message: "Successfully wrote to package.json"
      });
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/package.json",
        expectedStringContent
      );
    });

    it("should create directory if it doesn't exist", async () => {
      const content = "test content";
      mockContext.fileSystem.exists = vi.fn().mockResolvedValue(false);
      mockContext.fileSystem.mkdir = vi.fn().mockResolvedValue(undefined);
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "new/directory/file.js", content },
        mockContext
      );

      expect(mockContext.fileSystem.exists).toHaveBeenCalledWith(
        "/test/workspace/new/directory"
      );
      expect(mockContext.fileSystem.mkdir).toHaveBeenCalledWith(
        "/test/workspace/new/directory",
        { recursive: true }
      );
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/new/directory/file.js",
        content
      );
    });

    it("should not create directory if it already exists", async () => {
      const content = "test content";
      mockContext.fileSystem.exists = vi.fn().mockResolvedValue(true);
      mockContext.fileSystem.mkdir = vi.fn().mockResolvedValue(undefined);
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "existing/file.js", content },
        mockContext
      );

      expect(mockContext.fileSystem.exists).toHaveBeenCalled();
      expect(mockContext.fileSystem.mkdir).not.toHaveBeenCalled();
    });

    it("should handle write error", async () => {
      const error = new Error("EACCES: permission denied");
      mockContext.fileSystem.writeFile = vi.fn().mockRejectedValue(error);

      const result = await writeImplementation(
        { file_path: "readonly.js", content: "test" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "EACCES: permission denied"
      });
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        "Tool:Write failed",
        error,
        { file_path: "readonly.js", content: "test" }
      );
    });

    it("should handle directory creation error", async () => {
      const error = new Error("mkdir failed");
      mockContext.fileSystem.exists = vi.fn().mockResolvedValue(false);
      mockContext.fileSystem.mkdir = vi.fn().mockRejectedValue(error);

      const result = await writeImplementation(
        { file_path: "bad/path/file.js", content: "test" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "mkdir failed"
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockContext.fileSystem.writeFile = vi.fn().mockRejectedValue("String error");

      const result = await writeImplementation(
        { file_path: "test.js", content: "test" },
        mockContext
      );

      expect(result).toEqual({
        success: false,
        message: "String error"
      });
    });

    it("should handle empty string content", async () => {
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      const result = await writeImplementation(
        { file_path: "empty.js", content: "" },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        message: "Successfully wrote to empty.js"
      });
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/empty.js",
        ""
      );
    });

    it("should handle complex nested JSON objects", async () => {
      const content = {
        scripts: { build: "tsc", test: "vitest" },
        dependencies: { react: "^18.0.0" },
        nested: { deep: { value: 42 } }
      };
      const expectedStringContent = JSON.stringify(content, null, 2);
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "complex.json", content },
        mockContext
      );

      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/complex.json",
        expectedStringContent
      );
    });
  });

  describe("createWriteTool", () => {
    it("should create a valid LM Studio tool", () => {
      const tool = createWriteTool();

      expect(tool.name).toBe("Write");
      expect(tool.description).toBe("write content to a file");
      expect(tool.parameters).toBe(writeParameters);
      expect(typeof tool.implementation).toBe("function");
    });

    it("should have working implementation", async () => {
      const tool = createWriteTool();
      expect(tool.implementation).toBeDefined();
    });
  });

  describe("path resolution edge cases", () => {
    it("should handle paths with '..' correctly", async () => {
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "../parent/file.js", content: "test" },
        mockContext
      );

      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/parent/file.js",
        "test"
      );
    });

    it("should handle paths with '.' correctly", async () => {
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "./current/file.js", content: "test" },
        mockContext
      );

      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/current/file.js",
        "test"
      );
    });

    it("should not modify absolute paths", async () => {
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);

      await writeImplementation(
        { file_path: "/absolute/path/file.js", content: "test" },
        mockContext
      );

      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/absolute/path/file.js",
        "test"
      );
    });
  });
});