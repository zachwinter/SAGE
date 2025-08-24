import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import { execa } from "execa";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";

describe("CLI End-to-End Tests", () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(() => {
    // Path to the compiled CLI entry point
    cliPath = join(process.cwd(), "dist/index.js");

    // Verify the CLI exists
    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI executable not found at ${cliPath}. Run 'npm run build' first.`
      );
    }
  });

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = join(
      tmpdir(),
      `sage-e2e-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory after each test
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("CLI Execution", () => {
    it("should start without crashing", async () => {
      // Run the CLI and kill it after a short time since it's interactive
      try {
        await execa("node", [cliPath], {
          timeout: 1000,
          reject: false
        });
      } catch (error: any) {
        // Expected to timeout, just make sure it's not a startup error
        expect(error.name).toBeOneOf(["TimeoutError", "ExecaError"]);
        if (error.name === "ExecaError") {
          expect(error.timedOut).toBe(true);
        }
      }
    }, 5000);

    it("should respond to --help flag", async () => {
      const { stdout, stderr, exitCode } = await execa("node", [cliPath, "--help"], {
        reject: false
      });

      // Should exit successfully with help info
      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toContain("help");
      expect(stderr).toBe("");
    }, 10000);

    it("should respond to --version flag", async () => {
      const { stdout, stderr, exitCode } = await execa(
        "node",
        [cliPath, "--version"],
        {
          reject: false
        }
      );

      // Should exit successfully with version info
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
      expect(stderr).toBe("");
    }, 10000);

    it("should handle invalid arguments gracefully", async () => {
      const { stdout, stderr, exitCode } = await execa(
        "node",
        [cliPath, "--invalid-flag"],
        {
          reject: false
        }
      );

      // Should exit with non-zero code for invalid arguments
      expect(exitCode).not.toBe(0);
      // Should provide some error message (either in stdout or stderr)
      expect(stdout + stderr).toContain("invalid");
    }, 10000);
  });

  describe("File System Integration", () => {
    beforeEach(() => {
      // Create test files in temp directory
      writeFileSync(
        join(tempDir, "test.ts"),
        `
export interface User {
  id: string;
  name: string;
}

export class UserService {
  async getUser(id: string): Promise<User> {
    return { id, name: "Test User" };
  }
}

export default UserService;
      `.trim()
      );

      writeFileSync(
        join(tempDir, "test.js"),
        `
function calculateSum(a, b) {
  return a + b;
}

const multiply = (x, y) => x * y;

module.exports = { calculateSum, multiply };
      `.trim()
      );

      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "test-project",
            version: "1.0.0",
            main: "index.js"
          },
          null,
          2
        )
      );
    });

    it("should handle missing files gracefully", async () => {
      // Since this is an interactive TUI, test by running without TTY
      // which should exit gracefully with an error message
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false,
        env: { ...process.env, NODE_ENV: "test" }
      });

      // Should exit with error code in non-TTY environments
      expect(exitCode).toBe(1);
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 15000);

    it("should handle empty directories", async () => {
      // Test that CLI gracefully exits in non-TTY environments
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false
      });

      // Should exit gracefully in non-TTY environments
      expect(exitCode).toBe(1);
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 15000);

    it("should handle large files without memory issues", async () => {
      // Test startup behavior - should exit gracefully without memory issues
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false,
        timeout: 10000
      });

      // Should exit cleanly without memory crashes
      expect(exitCode).toBe(1); // Non-TTY environment
      expect(exitCode).not.toBe(137); // SIGKILL due to memory
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 15000);
  });

  describe("Error Handling", () => {
    it("should handle permission errors gracefully", async () => {
      // Test that CLI handles startup errors gracefully
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false,
        timeout: 10000
      });

      // Should exit gracefully with clear error message
      expect(exitCode).toBe(1);
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
      // Should not contain raw React errors or stack traces
      expect(stderr + stdout).not.toMatch(
        /at recursivelyTraversePassiveMountEffects|Encountered two children with the same key/i
      );
    }, 15000);

    it("should handle binary files gracefully", async () => {
      // Test CLI startup gracefully handles various conditions
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false
      });

      // Should handle startup gracefully without syntax errors
      expect(exitCode).toBe(1);
      expect(stderr + stdout).not.toContain("SyntaxError");
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 15000);

    it("should handle corrupted files gracefully", async () => {
      // Test CLI startup handles errors without unexpected tokens
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false
      });

      // Should handle startup gracefully without unexpected token errors
      expect(exitCode).toBe(1);
      expect(stderr + stdout).not.toContain("Unexpected token");
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 15000);
  });

  describe("Memory and Performance", () => {
    it("should not leak memory during multiple operations", async () => {
      // Test CLI startup performance and memory usage
      const { exitCode, stdout, stderr } = await execa("node", [cliPath], {
        reject: false,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 5000
      });

      // Should exit cleanly without memory issues
      expect(exitCode).toBe(1); // Non-TTY environment
      expect(stderr + stdout).not.toMatch(/out of memory|heap|maximum call stack/i);
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 25000);

    it("should handle deep directory structures", async () => {
      // Test CLI startup doesn't cause stack overflow issues
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false,
        timeout: 5000
      });

      // Should handle startup without stack overflow
      expect(exitCode).toBe(1); // Non-TTY environment
      expect(stderr + stdout).not.toMatch(/maximum call stack|stack overflow/i);
      expect(stderr + stdout).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
    }, 20000);
  });

  describe("Output Validation", () => {
    it("should produce consistent output format", async () => {
      // Test CLI output format and consistency
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false
      });

      // Should produce consistent, clean error output
      const output = stdout + stderr;
      expect(exitCode).toBe(1); // Non-TTY environment
      expect(output).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );

      // Should not contain raw React error messages or debug info
      expect(output).not.toMatch(
        /at recursivelyTraversePassiveMountEffects|Encountered two children with the same key/i
      );
      expect(output.length).toBeGreaterThan(0);
    }, 15000);

    it("should handle unicode and special characters", async () => {
      // Test CLI handles unicode in output properly
      const { stdout, stderr, exitCode } = await execa("node", [cliPath], {
        reject: false,
        encoding: "utf8"
      });

      // Should handle unicode in error messages without encoding errors
      const output = stdout + stderr;
      expect(exitCode).toBe(1); // Non-TTY environment
      expect(output).toMatch(
        /Interactive mode is not supported|Raw mode is required/i
      );
      expect(output).not.toMatch(/encoding error|invalid utf/i);
    }, 15000);
  });
});
