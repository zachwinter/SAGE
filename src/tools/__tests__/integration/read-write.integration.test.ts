import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Read } from "../../Read.js";
import { Write } from "../../Write.js";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Read/Write Tools Integration Tests", () => {
  let tempDir: string;
  let testFile: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `read-write-integration-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "test-file.txt");
  });

  afterAll(() => {
    // Restore original working directory
    process.chdir(originalCwd);
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up any existing test file
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
    // Restore CWD for tests that change it
    process.chdir(originalCwd);
  });

  describe("Write Tool Integration", () => {
    describe("Basic file writing", () => {
      it("should write content to a new file with absolute path", async () => {
        const content = "Hello, integration test!";

        const result = await Write.implementation({
          file_path: testFile,
          content
        });

        expect(existsSync(testFile)).toBe(true);
        expect(readFileSync(testFile, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should write content to a new file with relative path", async () => {
        // Change to temp directory
        process.chdir(tempDir);
        const relativeFile = "relative-test.txt";
        const content = "Relative path test";

        const result = await Write.implementation({
          file_path: relativeFile,
          content
        });

        const fullPath = join(tempDir, relativeFile);
        expect(existsSync(fullPath)).toBe(true);
        expect(readFileSync(fullPath, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should overwrite existing file content", async () => {
        const originalContent = "Original content";
        const newContent = "New content";

        // Create file with original content
        writeFileSync(testFile, originalContent);
        expect(readFileSync(testFile, "utf8")).toBe(originalContent);

        // Overwrite with new content
        const result = await Write.implementation({
          file_path: testFile,
          content: newContent
        });

        expect(readFileSync(testFile, "utf8")).toBe(newContent);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });
    });

    describe("Directory creation", () => {
      it("should create nested directories when they don't exist", async () => {
        const nestedFile = join(tempDir, "level1", "level2", "level3", "nested.txt");
        const content = "Nested directory test";

        const result = await Write.implementation({
          file_path: nestedFile,
          content
        });

        expect(existsSync(nestedFile)).toBe(true);
        expect(readFileSync(nestedFile, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should work when intermediate directories already exist", async () => {
        const level1Dir = join(tempDir, "existing");
        mkdirSync(level1Dir);

        const nestedFile = join(level1Dir, "level2", "file.txt");
        const content = "Partial directory structure";

        const result = await Write.implementation({
          file_path: nestedFile,
          content
        });

        expect(existsSync(nestedFile)).toBe(true);
        expect(readFileSync(nestedFile, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });
    });

    describe("Content types and formats", () => {
      it("should handle empty content", async () => {
        const content = "";

        const result = await Write.implementation({
          file_path: testFile,
          content
        });

        expect(existsSync(testFile)).toBe(true);
        expect(readFileSync(testFile, "utf8")).toBe("");
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should handle multi-line content", async () => {
        const content = "Line 1\nLine 2\nLine 3\n";

        const result = await Write.implementation({
          file_path: testFile,
          content
        });

        expect(readFileSync(testFile, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should handle content with special characters", async () => {
        const content = "Special chars: àáâãäå æç èéêë ìíîï ñ òóôõö ùúûü ýÿ 🚀 🎉";

        const result = await Write.implementation({
          file_path: testFile,
          content
        });

        expect(readFileSync(testFile, "utf8")).toBe(content);
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should handle JSON content as string", async () => {
        const jsonContent = JSON.stringify(
          {
            name: "test",
            value: 42,
            nested: { array: [1, 2, 3] }
          },
          null,
          2
        );

        const result = await Write.implementation({
          file_path: join(tempDir, "test.json"),
          content: jsonContent
        });

        const written = readFileSync(join(tempDir, "test.json"), "utf8");
        expect(JSON.parse(written)).toEqual({
          name: "test",
          value: 42,
          nested: { array: [1, 2, 3] }
        });
        expect(result).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      });

      it("should automatically stringify object content", async () => {
        const jsonObject = {
          name: "auto-stringify",
          success: true,
          data: ["item1", "item2"]
        };

        const result = await Write.implementation({
          file_path: join(tempDir, "auto.json"),
          content: jsonObject
        });

        expect(result.success).toBe(true);

        // Read the file back and parse it to verify
        const writtenContent = readFileSync(join(tempDir, "auto.json"), "utf8");
        const parsedContent = JSON.parse(writtenContent);

        expect(parsedContent).toEqual(jsonObject);
        // It should also pretty-print the JSON
        expect(writtenContent).toContain('\n  "success": true,\n');
      });
    });
  });

  describe("Read Tool Integration", () => {
    describe("Basic file reading", () => {
      it("should read content from existing file with absolute path", async () => {
        const content = "Test content for reading";
        writeFileSync(testFile, content);

        const result = await Read.implementation({ file_path: testFile });

        expect(result.success).toBe(true);
        expect(result.message).toBe(content);
      });

      it("should read content from existing file with relative path", async () => {
        process.chdir(tempDir);
        const relativeFile = "relative-read.txt";
        const content = "Relative read test";

        writeFileSync(join(tempDir, relativeFile), content);

        const result = await Read.implementation({ file_path: relativeFile });

        expect(result.success).toBe(true);
        expect(result.message).toBe(content);
      });

      it("should read empty files", async () => {
        writeFileSync(testFile, "");

        const result = await Read.implementation({ file_path: testFile });

        expect(result.success).toBe(true);
        expect(result.message).toBe("");
      });

      it("should read multi-line content", async () => {
        const content = "Line 1\nLine 2\nLine 3\n";
        writeFileSync(testFile, content);

        const result = await Read.implementation({ file_path: testFile });

        expect(result.success).toBe(true);
        expect(result.message).toBe(content);
      });
    });

    describe("Error handling", () => {
      it("should handle non-existent files gracefully", async () => {
        const nonExistentFile = join(tempDir, "does-not-exist.txt");

        const result = await Read.implementation({ file_path: nonExistentFile });

        expect(result.success).toBe(false);
        expect(result.message).toContain("ENOENT");
      });

      it("should handle permission errors gracefully", async () => {
        // This test might not work on all systems, but we'll try
        // On non-root systems, this will likely be ENOENT (path doesn't exist)
        const restrictedPath = "/root/restricted-file.txt";

        const result = await Read.implementation({ file_path: restrictedPath });

        expect(result.success).toBe(false);
        // Could be EACCES or ENOENT depending on the system and permissions
        expect(result.message).toMatch(/EACCES|ENOENT/);
      });

      it("should handle directory path instead of file", async () => {
        const result = await Read.implementation({ file_path: tempDir });

        expect(result.success).toBe(false);
        expect(result.message).toContain("EISDIR");
      });
    });

    describe("Path resolution", () => {
      it("should resolve paths correctly", async () => {
        const content = "Path resolution test";
        writeFileSync(testFile, content);

        // Change directory to the parent of tempDir
        process.chdir(join(tempDir, ".."));
        // Use a relative path to the test file
        const relativePath = join(tempDir.split(/\/|\\/).pop()!, "test-file.txt");

        const result = await Read.implementation({ file_path: relativePath });

        expect(result.success).toBe(true);
        expect(result.message).toBe(content);
      });
    });

    describe("File encoding and content types", () => {
      it("should read UTF-8 encoded files correctly", async () => {
        const content = "UTF-8 content: àáâãäå æç èéêë ìíîï ñ òóôõö ùúûü ýÿ 🚀";
        writeFileSync(testFile, content, "utf8");

        const result = await Read.implementation({ file_path: testFile });

        expect(result.success).toBe(true);
        expect(result.message).toBe(content);
      });

      it("should read JSON files as strings", async () => {
        const jsonData = {
          name: "test",
          value: 42,
          array: [1, 2, 3]
        };
        const jsonString = JSON.stringify(jsonData, null, 2);
        writeFileSync(join(tempDir, "test.json"), jsonString);

        const result = await Read.implementation({
          file_path: join(tempDir, "test.json")
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe(jsonString);
        if (result.success) {
          expect(JSON.parse(result.message)).toEqual(jsonData);
        }
      });

      it("should read code files correctly", async () => {
        const codeContent = `function example() {
  console.log("Hello, world!");
  return 42;
}

export default example;`;
        writeFileSync(join(tempDir, "example.js"), codeContent);

        const result = await Read.implementation({
          file_path: join(tempDir, "example.js")
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe(codeContent);
      });
    });
  });

  describe("Read/Write Integration Workflows", () => {
    it("should support read-modify-write workflows", async () => {
      const originalContent = "Original content\nSecond line";
      const modification = "\nThird line added";

      // Write initial content
      await Write.implementation({
        file_path: testFile,
        content: originalContent
      });

      // Read content
      const readResult = await Read.implementation({ file_path: testFile });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(originalContent);

      // Modify and write back
      const modifiedContent = readResult.message + modification;
      await Write.implementation({
        file_path: testFile,
        content: modifiedContent
      });

      // Verify final content
      const finalResult = await Read.implementation({ file_path: testFile });
      expect(finalResult.success).toBe(true);
      expect(finalResult.message).toBe(originalContent + modification);
    });

    it("should handle concurrent read/write operations", async () => {
      const content1 = "Content from operation 1";
      const content2 = "Content from operation 2";
      const file1 = join(tempDir, "concurrent1.txt");
      const file2 = join(tempDir, "concurrent2.txt");

      // Perform concurrent operations
      const [writeResult1, writeResult2] = await Promise.all([
        Write.implementation({ file_path: file1, content: content1 }),
        Write.implementation({ file_path: file2, content: content2 })
      ]);

      expect(writeResult1.success).toBe(true);
      expect(writeResult2.success).toBe(true);

      // Read back concurrently
      const [readResult1, readResult2] = await Promise.all([
        Read.implementation({ file_path: file1 }),
        Read.implementation({ file_path: file2 })
      ]);

      expect(readResult1.success).toBe(true);
      expect(readResult1.message).toBe(content1);
      expect(readResult2.success).toBe(true);
      expect(readResult2.message).toBe(content2);
    });

    it("should handle large file operations", async () => {
      // Generate a larger content string
      const largeContent = "Lorem ipsum ".repeat(10000) + "\n".repeat(1000);

      const writeResult = await Write.implementation({
        file_path: testFile,
        content: largeContent
      });

      expect(writeResult.success).toBe(true);

      const readResult = await Read.implementation({ file_path: testFile });

      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(largeContent);
      if (readResult.success) {
        expect(readResult.message.length).toBe(largeContent.length);
      }
    });

    it("should maintain file integrity through multiple operations", async () => {
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const content = `Iteration ${i} content`;

        await Write.implementation({
          file_path: testFile,
          content
        });

        const readResult = await Read.implementation({ file_path: testFile });
        expect(readResult.success).toBe(true);
        expect(readResult.message).toBe(content);
      }
    });
  });
});
