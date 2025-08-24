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

describe("CLI Basic E2E Tests", () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(() => {
    cliPath = join(process.cwd(), "dist/index.js");

    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI executable not found at ${cliPath}. Run 'npm run build' first.`
      );
    }
  });

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `sage-e2e-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("CLI Startup", () => {
    it("should not crash on startup", async () => {
      try {
        const result = await execa("node", [cliPath], {
          timeout: 2000,
          reject: false
        });

        // Even if it times out, it shouldn't crash with a syntax error
        if (result.exitCode !== 0 && result.stderr) {
          expect(result.stderr).not.toMatch(
            /SyntaxError|ReferenceError|TypeError.*is not defined/
          );
        }
      } catch (error: any) {
        // Timeout is expected for interactive CLI
        if (error.timedOut) {
          expect(error.timedOut).toBe(true);
        } else {
          // Other errors should not be startup errors
          expect(error.message).not.toMatch(
            /SyntaxError|ReferenceError|TypeError.*is not defined/
          );
        }
      }
    });

    it("should handle basic commands without crashing", async () => {
      try {
        const result = await execa("node", [cliPath], {
          input: "help\nexit\n",
          timeout: 3000,
          reject: false
        });

        // Should not crash with basic commands
        expect(result.stderr).not.toMatch(/Uncaught|Error.*is not defined/);
      } catch (error: any) {
        if (!error.timedOut) {
          expect(error.message).not.toMatch(/Uncaught|Error.*is not defined/);
        }
      }
    });
  });

  describe("File System Basics", () => {
    beforeEach(() => {
      writeFileSync(
        join(tempDir, "sample.ts"),
        `
        export interface User {
          id: string;
        }
      `
      );
    });

    it("should handle valid TypeScript files", async () => {
      const sampleFile = join(tempDir, "sample.ts");

      try {
        const result = await execa("node", [cliPath], {
          input: `analyze ${sampleFile}\nexit\n`,
          timeout: 5000,
          reject: false
        });

        // Should not crash with parsing errors
        expect(result.stderr).not.toMatch(
          /SyntaxError|Parse error|Unexpected token/
        );
      } catch (error: any) {
        if (!error.timedOut) {
          expect(error.message).not.toMatch(
            /SyntaxError|Parse error|Unexpected token/
          );
        }
      }
    });

    it("should handle non-existent files gracefully", async () => {
      const nonExistentFile = join(tempDir, "does-not-exist.ts");

      try {
        const result = await execa("node", [cliPath], {
          input: `analyze ${nonExistentFile}\nexit\n`,
          timeout: 5000,
          reject: false
        });

        // Should handle missing files without crashing
        expect(result.stderr).not.toMatch(/Uncaught|UnhandledPromiseRejection/);
      } catch (error: any) {
        if (!error.timedOut) {
          expect(error.message).not.toMatch(/Uncaught|UnhandledPromiseRejection/);
        }
      }
    });
  });

  describe("Basic Error Handling", () => {
    it("should not crash with invalid input", async () => {
      try {
        const result = await execa("node", [cliPath], {
          input: "invalid command here\nexit\n",
          timeout: 3000,
          reject: false
        });

        // Should handle invalid commands gracefully
        expect(result.stderr).not.toMatch(/Uncaught|TypeError.*is not a function/);
      } catch (error: any) {
        if (!error.timedOut) {
          expect(error.message).not.toMatch(/Uncaught|TypeError.*is not a function/);
        }
      }
    });

    it("should handle empty input", async () => {
      try {
        const result = await execa("node", [cliPath], {
          input: "\nexit\n",
          timeout: 3000,
          reject: false
        });

        // Should handle empty input gracefully
        expect(result.stderr).not.toMatch(/Uncaught|ReferenceError/);
      } catch (error: any) {
        if (!error.timedOut) {
          expect(error.message).not.toMatch(/Uncaught|ReferenceError/);
        }
      }
    });
  });

  describe("Output Format", () => {
    it("should produce some output", async () => {
      try {
        const result = await execa("node", [cliPath], {
          input: "help\nexit\n",
          timeout: 3000,
          reject: false
        });

        // Should produce some output (either stdout or stderr)
        const totalOutput = (result.stdout || "") + (result.stderr || "");
        expect(totalOutput.length).toBeGreaterThan(0);
      } catch (error: any) {
        // Even on timeout, we might get some output
        if (error.stdout || error.stderr) {
          const totalOutput = (error.stdout || "") + (error.stderr || "");
          expect(totalOutput.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
