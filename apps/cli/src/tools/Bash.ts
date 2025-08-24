import { tool } from "@lmstudio/sdk";
import { Logger } from "@sage/utils";
import { spawn } from "child_process";
import { cwd } from "process";
import { z } from "zod";

const logger = new Logger("tools:bash", "debug.log");

export const Bash = tool({
  name: "Bash",
  description: "execute bash commands",
  parameters: {
    command: z.string(),
    timeout: z
      .number()
      .optional()
      .describe("timeout in milliseconds (default: 30000)")
  },
  implementation: async ({ command, timeout = 30000 }) => {
    logger.info(`Tool:Bash invoked`, { command, timeout });

    try {
      const workingDir = cwd();

      return new Promise(resolve => {
        const child = spawn("bash", ["-c", command], {
          cwd: workingDir,
          stdio: "pipe"
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
            message: `Command timed out after ${timeout}ms.${output ? `\nOutput:\n${output}` : ""}`
          });
        }, timeout);

        child.on("close", code => {
          if (code === 0) {
            logger.info(`Tool:Bash success`, { command, bytes: stdout.length });
            safeResolve({ success: true, message: stdout.trim() });
          } else {
            const errorMessage = stderr.trim() || stdout.trim();
            logger.error(`Tool:Bash failed`, new Error(errorMessage), {
              command,
              stderr,
              stdout
            });
            safeResolve({
              success: false,
              message: `Command failed with exit code ${code}. ${errorMessage}`
            });
          }
        });

        child.on("error", err => {
          logger.error(`Tool:Bash failed`, err, { command });
          safeResolve({
            success: false,
            message: `Failed to start process: ${err.message}`
          });
        });
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool:Bash failed`, error as Error, { command, timeout });
      return {
        success: false,
        message: errorMessage
      };
    }
  }
});
