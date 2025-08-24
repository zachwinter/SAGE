import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Bash } from "../../Bash.js"; // Assuming this path is correct
import { writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Bash Tool Integration Tests", () => {
  let tempDir: string;
  let testFile: string;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `bash-integration-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "test-file.txt");
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Basic command execution", () => {
    it("should execute simple commands and return stdout", async () => {
      const result = await Bash.implementation({ command: "echo 'Hello World'" });
      expect(result.success).toBe(true);
      // The refactored tool trims whitespace, so we don't need .toContain
      expect(result.message).toBe("Hello World");
    });

    it("should execute commands with multiple lines of output", async () => {
      const result = await Bash.implementation({
        command: "echo 'Line 1\nLine 2\nLine 3'"
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle commands that produce no output", async () => {
      const result = await Bash.implementation({ command: "true" });
      expect(result.success).toBe(true);
      expect(result.message).toBe("");
    });
  });

  describe("File system operations", () => {
    it("should create and interact with files", async () => {
      const content = "Integration test content";
      const createResult = await Bash.implementation({
        command: `echo "${content}" > "${testFile}"`
      });
      expect(createResult.success).toBe(true);
      // Redirection means the command itself has no stdout
      expect(createResult.message).toBe("");
      expect(existsSync(testFile)).toBe(true);

      const readResult = await Bash.implementation({
        command: `cat "${testFile}"`
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);
    });

    it("should list directory contents", async () => {
      writeFileSync(join(tempDir, "file1.txt"), "content1");
      writeFileSync(join(tempDir, "file2.txt"), "content2");

      const result = await Bash.implementation({
        command: `ls "${tempDir}"`
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("file1.txt");
      expect(result.message).toContain("file2.txt");
    });

    it("should handle file operations with spaces in paths", async () => {
      const spacePath = join(tempDir, "file with spaces.txt");
      const content = "spaces test";

      const createResult = await Bash.implementation({
        command: `echo "${content}" > "${spacePath}"`
      });
      expect(createResult.success).toBe(true);
      expect(existsSync(spacePath)).toBe(true);

      const readResult = await Bash.implementation({
        command: `cat "${spacePath}"`
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);
    });
  });

  describe("Error handling", () => {
    it("should handle command failures gracefully", async () => {
      const result = await Bash.implementation({
        command: "nonexistentcommand"
      });
      expect(result.success).toBe(false);
      // Using a regex makes the test more robust across different shells
      expect(result.message).toMatch(/not found|no such file/i);
    });

    it("should handle commands with non-zero exit codes", async () => {
      const result = await Bash.implementation({
        command: "ls /nonexistent/directory"
      });
      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain("no such file");
    });

    it("should handle syntax errors in bash commands", async () => {
      const result = await Bash.implementation({
        command: "if [ incomplete syntax"
      });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/syntax error|unexpected end of file/i);
    });
  });

  describe("Timeout handling", () => {
    it("should respect custom timeout values", async () => {
      const startTime = Date.now();
      const result = await Bash.implementation({
        command: "sleep 0.5",
        timeout: 1000
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);
      expect(endTime - startTime).toBeLessThan(1500); // Allow for overhead
    });

    it("should timeout long-running commands", async () => {
      const startTime = Date.now();
      const result = await Bash.implementation({
        command: "sleep 2",
        timeout: 500
      });
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should be a bit over 500ms
      expect(result.message).toContain("Command timed out after 500ms");
    });
  });

  describe("Working directory behavior", () => {
    it("should execute commands in the correct working directory", async () => {
      const result = await Bash.implementation({ command: "pwd" });
      expect(result.success).toBe(true);
      expect(result.message.trim()).toBe(process.cwd());
    });

    it("should allow changing directory within command", async () => {
      const result = await Bash.implementation({
        command: `cd "${tempDir}" && pwd`
      });
      expect(result.success).toBe(true);
      expect(result.message.trim()).toBe(tempDir);
    });
  });

  describe("Environment and shell features", () => {
    it("should support environment variables", async () => {
      const result = await Bash.implementation({
        command: "TEST_VAR='integration_test' && echo $TEST_VAR"
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("integration_test");
    });

    it("should support pipes and redirection", async () => {
      const result = await Bash.implementation({
        command: "echo 'line1\nline2\nline3' | grep 'line2'"
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("line2");
    });

    it("should support command substitution", async () => {
      const result = await Bash.implementation({
        command: "echo \"Current time: $(date '+%Y')\""
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Current time:");
      expect(result.message).toMatch(/\d{4}/); // Should contain a year
    });
  });

  describe("Complex real-world scenarios", () => {
    it("should handle complex file processing pipeline", async () => {
      const dataFile = join(tempDir, "data.txt");
      writeFileSync(dataFile, "apple\nbanana\ncherry\napricot\nblueberry");

      const result = await Bash.implementation({
        command: `grep '^a' "${dataFile}" | wc -l`
      });
      expect(result.success).toBe(true);
      // wc -l can have leading whitespace depending on the system
      expect(result.message.trim()).toBe("2");
    });

    it("should execute multi-command scripts", async () => {
      // NOTE: Using a multi-line string directly is fine.
      const scriptContent = `
        set -e
        mkdir -p "${tempDir}/subdir"
        echo "test content" > "${tempDir}/subdir/test.txt"
        ls "${tempDir}/subdir"
        cat "${tempDir}/subdir/test.txt"
      `;

      const result = await Bash.implementation({
        command: scriptContent
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("test.txt");
      expect(result.message).toContain("test content");
    });
  });
});
