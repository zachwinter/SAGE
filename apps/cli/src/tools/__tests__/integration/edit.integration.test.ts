import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Edit } from "../../Edit.js";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Edit Tool Integration Tests", () => {
  let tempDir: string;
  let testFile: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `edit-integration-${Date.now()}`);
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
  });

  describe("Basic string replacement", () => {
    it("should replace a single occurrence of a string", async () => {
      const originalContent = "Hello world! This is a test.";
      const oldString = "world";
      const newString = "universe";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("Hello universe! This is a test.");
    });

    it("should replace multi-line strings", async () => {
      const originalContent = `Line 1
Line 2
Line 3
Line 4`;
      const oldString = "Line 2\nLine 3";
      const newString = "Modified Line 2\nModified Line 3";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(`Line 1
Modified Line 2
Modified Line 3
Line 4`);
    });

    it("should handle empty string replacements", async () => {
      const originalContent = "Remove this text and keep the rest.";
      const oldString = "Remove this text and ";
      const newString = "";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("keep the rest.");
    });

    it("should handle adding content", async () => {
      const originalContent = "Start End";
      const oldString = "Start ";
      const newString = "Start Middle ";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("Start Middle End");
    });
  });

  describe("Multiple occurrence handling", () => {
    it("should fail when old_string appears multiple times and replace_all is false", async () => {
      const originalContent = "test test test";
      const oldString = "test";
      const newString = "modified";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString,
        replace_all: false
      });

      expect(result).toEqual({
        success: false,
        message:
          "String appears multiple times in file. Use replace_all=true or provide more context to make it unique."
      });

      // File should remain unchanged
      expect(readFileSync(testFile, "utf8")).toBe(originalContent);
    });

    it("should replace all occurrences when replace_all is true", async () => {
      const originalContent = "test test test";
      const oldString = "test";
      const newString = "modified";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString,
        replace_all: true
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("modified modified modified");
    });

    it("should handle complex patterns with replace_all", async () => {
      const originalContent = `function oldName() {
  return oldName.value;
}

const result = oldName();`;
      const oldString = "oldName";
      const newString = "newName";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString,
        replace_all: true
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(`function newName() {
  return newName.value;
}

const result = newName();`);
    });
  });

  describe("Special characters and escaping", () => {
    it("should handle strings with special regex characters", async () => {
      const originalContent = "Price: $10.50 (includes $2.50 tax)";
      const oldString = "$10.50";
      const newString = "$15.75";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(
        "Price: $15.75 (includes $2.50 tax)"
      );
    });

    it("should handle strings with parentheses", async () => {
      const originalContent = "function test() { console.log('hello'); }";
      const oldString = "console.log('hello')";
      const newString = "console.log('world')";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(
        "function test() { console.log('world'); }"
      );
    });

    it("should handle strings with square brackets", async () => {
      const originalContent = "array[0] = value;";
      const oldString = "array[0]";
      const newString = "array[1]";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("array[1] = value;");
    });

    it("should handle strings with asterisks and plus signs", async () => {
      const originalContent = "2 * 3 + 4 = 10";
      const oldString = "2 * 3 + 4";
      const newString = "5 * 2";

      writeFileSync(testFile, originalContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("5 * 2 = 10");
    });
  });

  describe("Path handling", () => {
    it("should work with absolute paths", async () => {
      const content = "Absolute path test";
      writeFileSync(testFile, content);

      const result = await Edit.implementation({
        file_path: testFile, // absolute path
        old_string: "Absolute",
        new_string: "Modified"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe("Modified path test");
    });

    it("should work with relative paths", async () => {
      process.chdir(tempDir);
      const relativeFile = "relative-edit.txt";
      const content = "Relative path test";

      writeFileSync(join(tempDir, relativeFile), content);

      const result = await Edit.implementation({
        file_path: relativeFile,
        old_string: "Relative",
        new_string: "Modified"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(join(tempDir, relativeFile), "utf8")).toBe(
        "Modified path test"
      );
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent files", async () => {
      const nonExistentFile = join(tempDir, "does-not-exist.txt");

      const result = await Edit.implementation({
        file_path: nonExistentFile,
        old_string: "test",
        new_string: "modified"
      });

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("File not found")
      });
    });

    it("should handle strings that don't exist in file", async () => {
      const content = "This is the original content.";
      writeFileSync(testFile, content);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: "non-existent string",
        new_string: "replacement"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      // File should remain unchanged when string not found
      expect(readFileSync(testFile, "utf8")).toBe(content);
    });

    it("should handle permission errors gracefully", async () => {
      // This test might not work on all systems, but let's try
      const restrictedPath = "/root/restricted-file.txt";

      const result = await Edit.implementation({
        file_path: restrictedPath,
        old_string: "test",
        new_string: "modified"
      });

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("File not found")
      });
    });
  });

  describe("Real-world code editing scenarios", () => {
    it("should update function names in JavaScript code", async () => {
      const jsContent = `function calculateSum(a, b) {
  return a + b;
}

const result = calculateSum(5, 3);
console.log(result);`;

      writeFileSync(join(tempDir, "code.js"), jsContent);

      const result = await Edit.implementation({
        file_path: join(tempDir, "code.js"),
        old_string: "calculateSum",
        new_string: "computeTotal",
        replace_all: true
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(join(tempDir, "code.js"), "utf8"))
        .toBe(`function computeTotal(a, b) {
  return a + b;
}

const result = computeTotal(5, 3);
console.log(result);`);
    });

    it("should update import statements", async () => {
      const content = `import { oldModule } from './old-path';
import { otherModule } from './other-path';

const result = oldModule.process();`;

      writeFileSync(join(tempDir, "imports.js"), content);

      const result = await Edit.implementation({
        file_path: join(tempDir, "imports.js"),
        old_string: "import { oldModule } from './old-path';",
        new_string: "import { newModule as oldModule } from './new-path';"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(join(tempDir, "imports.js"), "utf8"))
        .toBe(`import { newModule as oldModule } from './new-path';
import { otherModule } from './other-path';

const result = oldModule.process();`);
    });

    it("should update configuration values", async () => {
      const configContent = `{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "mydb"
  },
  "cache": {
    "enabled": false,
    "ttl": 3600
  }
}`;

      writeFileSync(join(tempDir, "config.json"), configContent);

      const result = await Edit.implementation({
        file_path: join(tempDir, "config.json"),
        old_string: '"enabled": false',
        new_string: '"enabled": true'
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      const updatedConfig = JSON.parse(
        readFileSync(join(tempDir, "config.json"), "utf8")
      );
      expect(updatedConfig.cache.enabled).toBe(true);
    });

    it("should handle complex multi-line replacements", async () => {
      const content = `function oldImplementation() {
  const step1 = processData();
  const step2 = transformData(step1);
  return step2;
}`;

      const oldString = `const step1 = processData();
  const step2 = transformData(step1);
  return step2;`;

      const newString = `const processedData = processData();
  const transformedData = transformData(processedData);
  const validatedData = validateData(transformedData);
  return validatedData;`;

      writeFileSync(testFile, content);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: oldString,
        new_string: newString
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(`function oldImplementation() {
  const processedData = processData();
  const transformedData = transformData(processedData);
  const validatedData = validateData(transformedData);
  return validatedData;
}`);
    });
  });

  describe("Edge cases and robustness", () => {
    it("should handle very large files", async () => {
      const largeContent =
        "line\n".repeat(10000) + "target line\n" + "line\n".repeat(10000);
      writeFileSync(testFile, largeContent);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: "target line",
        new_string: "modified line"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toContain("modified line");
    });

    it("should handle files with unicode characters", async () => {
      const unicodeContent = "Hello 世界! 🚀 Testing unicode: àáâãäå";
      writeFileSync(testFile, unicodeContent, "utf8");

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: "世界",
        new_string: "World"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(
        "Hello World! 🚀 Testing unicode: àáâãäå"
      );
    });

    it("should handle replacement with same content", async () => {
      const content = "This content stays the same";
      writeFileSync(testFile, content);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: "content",
        new_string: "content"
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(content);
    });

    it("should maintain file structure and formatting", async () => {
      const content = `  const indented = {
    property: "value",
    nested: {
      deep: "structure"
    }
  };`;

      writeFileSync(testFile, content);

      const result = await Edit.implementation({
        file_path: testFile,
        old_string: '"value"',
        new_string: '"modified"'
      });

      expect(result).toEqual({ success: true, message: expect.any(String) });
      expect(readFileSync(testFile, "utf8")).toBe(`  const indented = {
    property: "modified",
    nested: {
      deep: "structure"
    }
  };`);
    });
  });
});
