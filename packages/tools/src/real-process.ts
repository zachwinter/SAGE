import { spawn } from "child_process";
import { cwd } from "process";
import { ProcessOperations } from "./interfaces.js";

export const realProcessOperations: ProcessOperations = {
  executeCommand: async (command, options = {}) => {
    const { cwd: workingDir = cwd(), timeout = 30000, env = process.env } = options;

    return new Promise(resolve => {
      const child = spawn("bash", ["-c", command], {
        cwd: workingDir,
        stdio: "pipe",
        env
      });

      let stdout = "";
      let stderr = "";
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (forceKillTimeoutId) clearTimeout(forceKillTimeoutId);
      };

      const safeResolve = (result: { success: boolean; message: string }) => {
        cleanup();
        resolve(result);
      };

      child.stdout.on("data", data => {
        stdout += data.toString();
      });

      child.stderr.on("data", data => {
        stderr += data.toString();
      });

      let forceKillTimeoutId: NodeJS.Timeout | null = null;

      const timeoutId = setTimeout(() => {
        if (resolved) return;

        try {
          child.kill("SIGTERM");
          forceKillTimeoutId = setTimeout(() => {
            if (!resolved && !child.killed) {
              child.kill("SIGKILL");
            }
          }, 1000);
        } catch (error) {
          // Ignore kill errors if process is already dead
        }

        const output = (stdout + stderr).trim();
        safeResolve({
          success: false,
          message: `Command timed out after ${timeout}ms.${
            output
              ? `
Output:
${output}`
              : ""
          }`
        });
      }, timeout);

      child.on("close", code => {
        if (code === 0) {
          safeResolve({ success: true, message: stdout.trim() });
        } else {
          const errorMessage = stderr.trim() || stdout.trim();
          safeResolve({
            success: false,
            message: `Command failed with exit code ${code}. ${errorMessage}`
          });
        }
      });

      child.on("error", err => {
        safeResolve({
          success: false,
          message: `Failed to start process: ${err.message}`
        });
      });
    });
  }
};
