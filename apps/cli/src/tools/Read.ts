import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { readFile } from "fs/promises";
import { resolve, isAbsolute } from "path";
import { cwd } from "process";
import Logger from "@/logger/logger.js";

export const Read = tool({
  name: "Read",
  description: "read a file from the filesystem",
  parameters: {
    file_path: z.string().describe("(relative or absolute)")
  },
  implementation: async ({ file_path }) => {
    Logger.info(`Tool:Read invoked`, { file_path });
    try {
      const resolvedPath = isAbsolute(file_path)
        ? file_path
        : resolve(cwd(), file_path);
      const content = await readFile(resolvedPath, "utf8");
      Logger.info(`Tool:Read success`, { file_path, bytes: content.length });
      return { success: true, message: content };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Tool:Read failed`, error as Error, { file_path });
      return {
        success: false,
        message: errorMessage
      };
    }
  }
});
