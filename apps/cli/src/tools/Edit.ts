import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { readFile, writeFile } from "fs/promises";
import { resolve, isAbsolute } from "path";
import { cwd } from "process";
import { existsSync } from "fs";
import { defaultFlexibleBoolean } from "@/tools/utils/zod-mixins.js";
import Logger from "@/logger/logger.js";

export const Edit = tool({
  name: "Edit",
  description: "Update the contents of a file.",
  parameters: {
    file_path: z.string().describe("(relative or absolute)"),
    old_string: z.string(),
    new_string: z.string(),
    replace_all: defaultFlexibleBoolean(
      false,
      "replace all occurences of old_string"
    )
  },
  implementation: async ({ file_path, old_string, new_string, replace_all }) => {
    const invocationArgs = { file_path, old_string, new_string, replace_all };
    Logger.info(`Tool:Edit invoked`, invocationArgs);

    try {
      const resolvedPath = isAbsolute(file_path)
        ? file_path
        : resolve(cwd(), file_path);
      if (!existsSync(resolvedPath)) {
        const message = `File not found: ${resolvedPath}`;
        Logger.error(`Tool:Edit failed`, new Error(message), invocationArgs);
        return {
          success: false,
          message
        };
      }

      const content = await readFile(resolvedPath, "utf8");
      let newContent;

      if (replace_all) {
        const regex = new RegExp(
          old_string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        );
        newContent = content.replace(regex, new_string);
      } else {
        const firstIndex = content.indexOf(old_string);
        // Only check for multiple occurrences if the string is found at least once
        if (firstIndex !== -1) {
          const lastIndex = content.lastIndexOf(old_string);
          if (firstIndex !== lastIndex) {
            const message =
              "String appears multiple times in file. Use replace_all=true or provide more context to make it unique.";
            Logger.warn(`Tool:Edit failed - multiple occurrences`, invocationArgs);
            return {
              success: false,
              message
            };
          }
        }
        newContent = content.replace(old_string, new_string);
      }

      if (content === newContent) {
        const message = `The string to be replaced was not found in ${file_path}. No changes were made.`;
        Logger.info(`Tool:Edit success (no changes)`, { file_path });
        return { success: true, message };
      }

      await writeFile(resolvedPath, newContent, "utf8");
      Logger.info(`Tool:Edit success`, { file_path, bytes: newContent.length });

      return {
        success: true,
        message: `Successfully edited ${file_path}`
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Tool:Edit failed`, error as Error, invocationArgs);
      return {
        success: false,
        message: errorMessage
      };
    }
  }
});
