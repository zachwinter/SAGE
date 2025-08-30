import { createWebAdapter } from "./adapters/web/index.js";

// Create and export the Web adapter
const webAdapter = createWebAdapter();

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
} = webAdapter;

// Export the full adapter as UI
export const UI = webAdapter;

export default UI;