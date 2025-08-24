import { tool } from "@lmstudio/sdk";
import { Logger } from "@sage/utils";
import { readFile } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { cwd } from "process";
import { z } from "zod";

const logger = new Logger("tools:read", "debug.log");

export const Read = tool({
  name: "Read",
  description: "read a file from the filesystem",
  parameters: {
    file_path: z.string().describe("(relative or absolute)")
  },
  implementation: async ({ file_path }) => {
    logger.info(`Tool:Read invoked`, { file_path });
    try {
      const resolvedPath = isAbsolute(file_path)
        ? file_path
        : resolve(cwd(), file_path);
      const content = await readFile(resolvedPath, "utf8");
      logger.info(`Tool:Read success`, { file_path, bytes: content.length });
      return { success: true, message: content };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool:Read failed`, error as Error, { file_path });
      return {
        success: false,
        message: errorMessage
      };
    }
  }
});
