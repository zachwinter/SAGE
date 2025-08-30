import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { ToolContext } from "./interfaces.js";
import { realProcessOperations } from "./real-process.js";
import { RealLogger } from "./real-logger.js";
import { cwd } from "process";

// Define the parameters schema
export const bashParameters = z.object({
  command: z.string(),
  timeout: z.number().optional().describe("timeout in milliseconds (default: 30000)")
});

// Export the type for this schema
export type BashParameters = z.infer<typeof bashParameters>;

// Pure implementation function that can be tested independently
export async function bashImplementation(
  args: BashParameters,
  context: ToolContext
) {
  const { command, timeout = 30000 } = args;
  context.logger.info(`Tool:Bash invoked`, { command, timeout });

  try {
    return await context.process.executeCommand(command, {
      cwd: context.workingDirectory,
      timeout
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`Tool:Bash failed`, error as Error, { command, timeout });
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Factory function to create the LM Studio tool with real dependencies
export function createBashTool() {
  const context: ToolContext = {
    fileSystem: {} as any, // Not used by Bash tool
    process: realProcessOperations,
    logger: new RealLogger(),
    workingDirectory: cwd()
  };

  return tool({
    name: "Bash",
    description: "execute bash commands",
    parameters: {
      command: bashParameters.shape.command,
      timeout: bashParameters.shape.timeout,
    },
    implementation: async (params: Record<string, unknown>) => {
      const args = bashParameters.parse(params);
      return bashImplementation(args, context);
    }
  });
}
