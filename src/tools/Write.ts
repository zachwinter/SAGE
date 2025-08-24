import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { resolve, isAbsolute, dirname } from "path";
import { cwd } from "process";
import { existsSync } from "fs";
import Logger from "@/logger/logger.js";

export const Write = tool({
  name: "Write",
  description: "write content to a file",
  parameters: {
    file_path: z.string().describe("the path to the file to write"),
    content: z
      .union([z.string(), z.record(z.any())])
      .describe(
        "the content to write to the file. For JSON files, this MUST be a valid JSON string. Do not provide a raw JSON object."
      )
  },
  implementation: async ({ file_path, content }) => {
    Logger.info(`Tool:Write invoked`, { file_path, content });

    try {
      const resolvedPath = isAbsolute(file_path)
        ? file_path
        : resolve(cwd(), file_path);
      const dir = dirname(resolvedPath);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      let stringContent: string;
      if (typeof content !== "string") {
        stringContent = JSON.stringify(content, null, 2);
      } else {
        stringContent = content;
      }
      await writeFile(resolvedPath, stringContent, "utf8");
      Logger.info(`Tool:Write success`, { file_path, bytes: stringContent.length });
      return { success: true, message: `Successfully wrote to ${file_path}` };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Tool:Write failed`, error as Error, { file_path, content });
      return {
        success: false,
        message: errorMessage
      };
    }
  }
});
