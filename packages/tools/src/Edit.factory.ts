import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { ToolContext } from "./interfaces.js";
import { realFileSystemOperations } from "./real-filesystem.js";
import { RealLogger } from "./real-logger.js";
import { isAbsolute, resolve } from "path";
import { cwd } from "process";
import { defaultFlexibleBoolean } from "./utils/zod-mixins.js";

// Define the parameters schema
export const editParameters = z.object({
  file_path: z.string().describe("(relative or absolute)"),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: defaultFlexibleBoolean(false, "replace all occurences of old_string")
});

// Type for the parameters
export type EditParameters = z.infer<typeof editParameters>;

// Pure implementation function that can be tested independently
export async function editImplementation(
  args: EditParameters,
  context: ToolContext
) {
  const { file_path, old_string, new_string, replace_all } = args;
  const invocationArgs = { file_path, old_string, new_string, replace_all };
  context.logger.info(`Tool:Edit invoked`, invocationArgs);

  try {
    const resolvedPath = isAbsolute(file_path)
      ? file_path
      : resolve(context.workingDirectory, file_path);

    if (!(await context.fileSystem.exists(resolvedPath))) {
      const message = `File not found: ${resolvedPath}`;
      context.logger.error(`Tool:Edit failed`, new Error(message), invocationArgs);
      return {
        success: false,
        message
      };
    }

    const content = await context.fileSystem.readFile(resolvedPath);
    let newContent: string;

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
        // If first and last index are different, there are multiple occurrences
        if (firstIndex !== lastIndex) {
          const message = "String appears multiple times in file. Use replace_all=true or provide more context to make it unique.";
          context.logger.info(
            `Tool:Edit failed - multiple occurrences`,
            invocationArgs
          );
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
      context.logger.info(`Tool:Edit success (no changes)`, { file_path });
      return { success: true, message };
    }

    await context.fileSystem.writeFile(resolvedPath, newContent);
    context.logger.info(`Tool:Edit success`, {
      file_path,
      bytes: newContent.length
    });

    return {
      success: true,
      message: `Successfully edited ${file_path}`
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`Tool:Edit failed`, error as Error, invocationArgs);
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Factory function to create the LM Studio tool with real dependencies
export function createEditTool() {
  const context: ToolContext = {
    fileSystem: realFileSystemOperations,
    process: {} as any, // Not used by Edit tool
    logger: new RealLogger(),
    workingDirectory: cwd()
  };

  return tool({
    name: "Edit",
    description: "Update the contents of a file.",
    parameters: {
      file_path: editParameters.shape.file_path,
      old_string: editParameters.shape.old_string,
      new_string: editParameters.shape.new_string,
      replace_all: editParameters.shape.replace_all,
    },
    implementation: async (params: Record<string, unknown>) => {
      const args = editParameters.parse(params);
      return editImplementation(args, context);
    }
  });
}
