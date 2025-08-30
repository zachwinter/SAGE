import { z } from "zod";

// Interfaces for tool dependencies
export interface FileSystemOperations {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  rm: (
    path: string,
    options?: { recursive?: boolean; force?: boolean }
  ) => Promise<void>;
}

export interface ProcessOperations {
  executeCommand: (
    command: string,
    options?: {
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    }
  ) => Promise<{ success: boolean; message: string }>;
}

export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, error?: Error, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Tool context that can be injected
export interface ToolContext {
  fileSystem: FileSystemOperations;
  process: ProcessOperations;
  logger: Logger;
  workingDirectory: string;
}

// Base tool interface
export interface BaseTool<T extends z.ZodObject<any> = any> {
  name: string;
  description: string;
  parameters: T;
  implementation: (
    args: z.infer<T>,
    context: ToolContext
  ) => Promise<any>;
}
