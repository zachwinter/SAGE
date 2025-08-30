import { ToolContext } from "./interfaces.js";

// Mock implementations for testing
export const mockFileSystem: ToolContext["fileSystem"] = {
  readFile: async path => `mock content of ${path}`,
  writeFile: async (path, content) => {
    // Mock implementation
  },
  exists: async path => true,
  mkdir: async (path, options) => {
    // Mock implementation
  },
  rm: async (path, options) => {
    // Mock implementation
  }
};

export const mockProcess: ToolContext["process"] = {
  executeCommand: async (command, options) => {
    return {
      success: true,
      message: `Mock output for: ${command}`
    };
  }
};

export const mockLogger: ToolContext["logger"] = {
  info: (message, meta) => {
    // Mock implementation
  },
  error: (message, error, meta) => {
    // Mock implementation
  },
  debug: (message, meta) => {
    // Mock implementation
  }
};

// Create a mock context for testing
export function createMockContext(
  overrides: Partial<ToolContext> = {}
): ToolContext {
  return {
    fileSystem: mockFileSystem,
    process: mockProcess,
    logger: mockLogger,
    workingDirectory: "/mock/working/dir",
    ...overrides
  };
}
