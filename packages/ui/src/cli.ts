import { createCLIAdapter } from "./adapters/cli/index.js";

// Create and export the CLI adapter
const cliAdapter = createCLIAdapter();

// Export individual components for direct import
export const {
  Text,
  Row,
  Column,
  Box,
  Chat,
  AssistantTurn,
  UserMessage,
  ToolCall,
  Spinner,
  ThemeProvider
} = cliAdapter;

// Export the full adapter as UI
export const UI = cliAdapter;

export default UI;