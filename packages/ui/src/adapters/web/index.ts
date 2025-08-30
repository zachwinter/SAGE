// Simple placeholder implementation for Web adapter
export const createWebAdapter = () => {
  return {
    Text: () => null,
    Row: () => null,
    Column: () => null,
    Box: () => null,
    Chat: () => null,
    AssistantTurn: () => null,
    UserMessage: () => null,
    ToolCall: () => null,
    Spinner: () => null,
    ThemeProvider: () => null,
  };
};

export default createWebAdapter;