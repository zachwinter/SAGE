// Example usage of @sage/ui in a CLI application
import { Text, Row, Column, Box } from "@sage/ui";
import { Chat, AssistantTurn, UserMessage } from "@sage/ui";
import { ThemeProvider, defaultTheme } from "@sage/ui/theme";

// Example 1: Basic layout with primitives
const App = () => (
  <ThemeProvider value={defaultTheme}>
    <Column gap={1}>
      <Row justify="space-between" align="center">
        <Text variant="title">SAGE CLI</Text>
        <Text dim>v1.0.0</Text>
      </Row>
      
      <Box border padding={1}>
        <Text>Welcome to SAGE!</Text>
      </Box>
      
      <Row gap={1}>
        <Text>Ready</Text>
        <Text dim>to assist</Text>
      </Row>
    </Column>
  </ThemeProvider>
);

// Example 2: Chat interface
const ChatApp = ({ stream }: { stream: AsyncIterable<any> }) => (
  <ThemeProvider value={defaultTheme}>
    <Column gap={1}>
      <UserMessage>
        <Text>How do I implement a new feature?</Text>
      </UserMessage>
      
      <AssistantTurn />
      
      <Chat stream={stream}>
        <UserMessage>Can you show me an example?</UserMessage>
        <AssistantTurn />
      </Chat>
    </Column>
  </ThemeProvider>
);

export { App, ChatApp };