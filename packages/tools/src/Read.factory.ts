import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { ToolContext } from "./interfaces.js";
import { realFileSystemOperations } from "./real-filesystem.js";
import { RealLogger } from "./real-logger.js";
import { isAbsolute, resolve } from "path";
import { cwd } from "process";

// Define the parameters schema
export const readParameters = z.object({
  absolute_path: z.string().describe("(relative or absolute)")
});

// Type for the parameters
export type ReadParameters = z.infer<typeof readParameters>;

// Pure implementation function that can be tested independently
export async function readImplementation(
  args: ReadParameters,
  context: ToolContext
) {
  const { absolute_path } = args;
  context.logger.info(`Tool:Read invoked`, { absolute_path });

  try {
    const resolvedPath = isAbsolute(absolute_path)
      ? absolute_path
      : resolve(context.workingDirectory, absolute_path);

    const content = await context.fileSystem.readFile(resolvedPath);
    context.logger.info(`Tool:Read success`, {
      absolute_path,
      bytes: content.length
    });
    return { success: true, content };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`Tool:Read failed`, error as Error, { absolute_path });
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Factory function to create the LM Studio tool with real dependencies
export function createReadTool() {
  const context: ToolContext = {
    fileSystem: realFileSystemOperations,
    process: {} as any, // Not used by Read tool
    logger: new RealLogger(),
    workingDirectory: cwd()
  };

  return tool({
    name: "Read",
    description: "read a file from the filesystem",
    parameters: {
      absolute_path: readParameters.shape.absolute_path,
    },
    implementation: async (params: Record<string, unknown>) => {
      const args = readParameters.parse(params);
      return readImplementation(args, context);
    }
  });
}
