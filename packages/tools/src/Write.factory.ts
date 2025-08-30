import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { ToolContext } from "./interfaces.js";
import { realFileSystemOperations } from "./real-filesystem.js";
import { RealLogger } from "./real-logger.js";
import { isAbsolute, resolve, dirname } from "path";
import { cwd } from "process";

// Define the parameters schema
export const writeParameters = z.object({
  file_path: z.string().describe("the path to the file to write"),
  content: z
    .union([z.string(), z.record(z.any())])
    .describe(
      "the content to write to the file. For JSON files, this MUST be a valid JSON string. Do not provide a raw JSON object."
    )
});

// Type for the parameters
export type WriteParameters = z.infer<typeof writeParameters>;

// Pure implementation function that can be tested independently
export async function writeImplementation(
  args: WriteParameters,
  context: ToolContext
) {
  const { file_path, content } = args;
  context.logger.info(`Tool:Write invoked`, { file_path, content });

  try {
    const resolvedPath = isAbsolute(file_path)
      ? file_path
      : resolve(context.workingDirectory, file_path);

    const dir = dirname(resolvedPath);
    if (!(await context.fileSystem.exists(dir))) {
      await context.fileSystem.mkdir(dir, { recursive: true });
    }

    let stringContent: string;
    if (typeof content !== "string") {
      stringContent = JSON.stringify(content, null, 2);
    } else {
      stringContent = content;
    }

    await context.fileSystem.writeFile(resolvedPath, stringContent);
    context.logger.info(`Tool:Write success`, {
      file_path,
      bytes: stringContent.length
    });
    return { success: true, message: `Successfully wrote to ${file_path}` };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`Tool:Write failed`, error as Error, {
      file_path,
      content
    });
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Factory function to create the LM Studio tool with real dependencies
export function createWriteTool() {
  const context: ToolContext = {
    fileSystem: realFileSystemOperations,
    process: {} as any, // Not used by Write tool
    logger: new RealLogger(),
    workingDirectory: cwd()
  };

  return tool({
    name: "Write",
    description: "write content to a file",
    parameters: {
      file_path: writeParameters.shape.file_path,
      content: writeParameters.shape.content,
    },
    implementation: async (params: Record<string, unknown>) => {
      const args = writeParameters.parse(params);
      return writeImplementation(args, context);
    }
  });
}
