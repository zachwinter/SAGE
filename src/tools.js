import { z } from "zod";
import { dirname } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { tool } from "@lmstudio/sdk";
import { spawn } from "child_process";

export const read = tool({
  name: "read",
  description: "Read a file.",
  parameters: {
    file_path: z.string(),
  },
  implementation: async ({ file_path }) => {
    try {
      const result = await readFile(file_path, "utf-8");
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

export const write = tool({
  name: "write",
  description: "Write a new file or overwrite an existing one.",
  parameters: {
    file_path: z.string(),
    content: z.string(),
  },
  implementation: async ({ file_path, content }) => {
    try {
      const dir = dirname(file_path);
      await mkdir(dir, { recursive: true });
      await writeFile(file_path, content, "utf-8");
      return {
        success: true,
        result: `Successfully wrote ${content.length} characters to ${file_path}`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

export const edit = tool({
  name: "edit",
  description: "Perform exact string replacements.",
  parameters: {
    file_path: z.string(),
    old_string: z.string(),
    new_string: z.string(),
    replace_all: z.boolean().optional().default(false),
  },
  implementation: async ({
    file_path: path,
    old_string: last,
    new_string: next,
    replace_all = false,
  }) => {
    try {
      const content = await readFile(path, "utf-8");
      if (!content.includes(last))
        return { success: false, error: `string not found` };
      const newContent = replace_all
        ? content.split(last).join(next)
        : content.replace(last, next);
      await writeFile(path, newContent, "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

export const bash = tool({
  name: "bash",
  description: "Run shell scripts.",
  parameters: {
    command: z.string(),
    timeout: z.number().optional(),
    description: z.string().optional(),
  },
  implementation: async ({ command, timeout = 120000 }) => {
    try {
      const result = await new Promise((resolve, reject) => {
        try {
          const process = spawn(command, {
            shell: true,
            maxBuffer: 1024 * 1024 * 10,
          });

          let output = "";
          let errorOutput = "";

          process.stdout.on("data", (data) => (output += data.toString()));
          process.stderr.on("data", (data) => (errorOutput += data.toString()));

          const timeoutId = setTimeout(() => {
            process.kill("SIGTERM");
            reject(
              new Error(
                `Command timed out after ${timeout}ms: ${command.substring(0, 50)}...`,
              ),
            );
          }, timeout);

          process.on("close", (code) => {
            clearTimeout(timeoutId);
            if (code === 0 || code === undefined) {
              resolve({ success: true, result: output + errorOutput });
            } else {
              reject(
                new Error(
                  `Command failed with exit code ${code}: ${command}\n${errorOutput}`,
                ),
              );
            }
          });

          process.on("error", (err) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to start process: ${err.message}`));
          });
        } catch (err) {
          reject(new Error(`Failed to spawn process: ${err.message}`));
        }
      });

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});
