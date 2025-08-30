import { describe, it, expect, beforeEach, vi } from "vitest";
import { editImplementation, editParameters, createEditTool } from "../Edit.factory.js";
import type { ToolContext } from "../interfaces.js";

describe("Edit Tool Factory", () => {
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
        debug: vi.fn(),
        warn: vi.fn()
      } as any,
      workingDirectory: "/test/workspace"
    };
  });

  describe("editParameters schema", () => {
    it("should validate valid edit parameters", () => {
      const validParams = {
        file_path: "/path/to/file.js",
        old_string: "const old = 'value'",
        new_string: "const new = 'value'",
        replace_all: false
      };
      expect(() => editParameters.parse(validParams)).not.toThrow();
    });

    it("should validate parameters with replace_all true", () => {
      const validParams = {
        file_path: "src/file.js",
        old_string: "oldFunction",
        new_string: "newFunction",
        replace_all: true
      };
      expect(() => editParameters.parse(validParams)).not.toThrow();
    });

    it("should default replace_all to false", () => {
      const params = {
        file_path: "file.js",
        old_string: "old",
        new_string: "new"
      };
      const parsed = editParameters.parse(params);
      expect(parsed.replace_all).toBe(false);
    });

    it("should reject empty old_string", () => {
      const invalidParams = {
        file_path: "file.js",
        old_string: "",
        new_string: "new"
      };
      expect(() => editParameters.parse(invalidParams)).toThrow();
    });

    it("should accept empty new_string (deletion)", () => {
      const validParams = {
        file_path: "file.js",
        old_string: "to_delete",
        new_string: ""
      };
      expect(() => editParameters.parse(validParams)).not.toThrow();
    });

    it("should require all required parameters", () => {
      const invalidParams = { file_path: "file.js" };
      expect(() => editParameters.parse(invalidParams)).toThrow();
    });
  });

  describe("editImplementation", () => {
    const originalContent = "function test() {
  console.log('old message');
  return 'old';
}";

    beforeEach(() => {
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(originalContent);
      mockContext.fileSystem.writeFile = vi.fn().mockResolvedValue(undefined);
    });

    it("should perform single string replacement successfully", async () => {
      const result = await editImplementation(
        {
          file_path: "/absolute/path/file.js",
          old_string: "old message",
          new_string: "new message",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Successfully edited /absolute/path/file.js");
      
      const expectedContent = originalContent.replace("old message", "new message");
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/absolute/path/file.js",
        expectedContent
      );
    });

    it("should resolve relative paths correctly", async () => {
      await editImplementation(
        {
          file_path: "src/index.js",
          old_string: "old message",
          new_string: "new message",
          replace_all: false
        },
        mockContext
      );

      expect(mockContext.fileSystem.readFile).toHaveBeenCalledWith(
        "/test/workspace/src/index.js"
      );
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/src/index.js",
        expect.any(String)
      );
    });

    it("should handle file not found error", async () => {
      mockContext.fileSystem.exists = vi.fn().mockResolvedValue(false);

      const result = await editImplementation(
        {
          file_path: "nonexistent.js",
          old_string: "old",
          new_string: "new",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("File not found");
      expect(mockContext.fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it("should handle multiple occurrences error when replace_all is false", async () => {
      const contentWithDuplicates = "old text and old text again";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(contentWithDuplicates);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old text",
          new_string: "new text",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("String appears multiple times");
      expect(mockContext.fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it("should replace all occurrences when replace_all is true", async () => {
      const contentWithDuplicates = "old text and old text again";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(contentWithDuplicates);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old text",
          new_string: "new text",
          replace_all: true
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        "new text and new text again"
      );
    });

    it("should handle regex special characters in old_string with replace_all", async () => {
      const content = "function test() { return 'hello'; }";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(content);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "function test() {",
          new_string: "function newTest() {",
          replace_all: true
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        "function newTest() { return 'hello'; }"
      );
    });

    it("should handle string not found scenario", async () => {
      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "nonexistent string",
          new_string: "replacement",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("string to be replaced was not found");
      expect(mockContext.fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it("should handle deletion by replacing with empty string", async () => {
      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old message",
          new_string: "",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const expectedContent = originalContent.replace("old message", "");
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        expectedContent
      );
    });

    it("should handle read file error", async () => {
      const error = new Error("Permission denied");
      mockContext.fileSystem.readFile = vi.fn().mockRejectedValue(error);

      const result = await editImplementation(
        {
          file_path: "protected.js",
          old_string: "old",
          new_string: "new",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Permission denied");
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        "Tool:Edit failed",
        error,
        expect.any(Object)
      );
    });

    it("should handle write file error", async () => {
      const error = new Error("Write failed");
      mockContext.fileSystem.writeFile = vi.fn().mockRejectedValue(error);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old message",
          new_string: "new message",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Write failed");
    });

    it("should handle non-Error exceptions", async () => {
      mockContext.fileSystem.readFile = vi.fn().mockRejectedValue("String error");

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old",
          new_string: "new",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("String error");
    });

    it("should handle multiline string replacements", async () => {
      const multilineContent = "function test() {
  const old = 'value';
  return old;
}";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(multilineContent);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "  const old = 'value';
  return old;",
          new_string: "  const updated = 'new value';
  return updated;",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        "function test() {
  const updated = 'new value';
  return updated;
}"
      );
    });

    it("should preserve exact indentation and whitespace", async () => {
      const indentedContent = "    if (condition) {
        doSomething();
    }";
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(indentedContent);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "        doSomething();",
          new_string: "        doSomethingElse();",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        "    if (condition) {
        doSomethingElse();
    }"
      );
    });
  });

  describe("createEditTool", () => {
    it("should create a valid LM Studio tool", () => {
      const tool = createEditTool();

      expect(tool.name).toBe("Edit");
      expect(tool.description).toBe("Update the contents of a file.");
      expect(tool.parameters).toBe(editParameters);
      expect(typeof tool.implementation).toBe("function");
    });

    it("should have working implementation", async () => {
      const tool = createEditTool();
      expect(tool.implementation).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty file content", async () => {
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue("");

      const result = await editImplementation(
        {
          file_path: "empty.js",
          old_string: "anything",
          new_string: "replacement",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("string to be replaced was not found");
    });

    it("should handle identical old_string and new_string", async () => {
      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: "old message",
          new_string: "old message",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("string to be replaced was not found");
      expect(mockContext.fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it("should handle very long strings", async () => {
      const longString = "x".repeat(10000);
      const contentWithLongString = `start ${longString} end`;
      mockContext.fileSystem.readFile = vi.fn().mockResolvedValue(contentWithLongString);

      const result = await editImplementation(
        {
          file_path: "file.js",
          old_string: longString,
          new_string: "replacement",
          replace_all: false
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockContext.fileSystem.writeFile).toHaveBeenCalledWith(
        "/test/workspace/file.js",
        "start replacement end"
      );
    });
  });
});