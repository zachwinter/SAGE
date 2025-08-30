import React from 'react';
import { render } from 'ink';
import { Text, Row, Column, Box, ThemeProvider } from '../cli.js';
import { defaultTheme } from '../theme.js';

const App = () => {
  return React.createElement(
    ThemeProvider,
    { value: defaultTheme },
    React.createElement(
      Column,
      { gap: 1 },
      React.createElement(
        Row,
        { justify: "space-between", align: "center" },
        React.createElement(Text, { variant: "title" }, "SAGE CLI"),
        React.createElement(Text, { dim: true }, "v1.0.0")
      ),
      React.createElement(
        Box,
        { border: true, padding: 1 },
        React.createElement(Text, null, "Welcome to SAGE!")
      ),
      React.createElement(
        Row,
        { gap: 1 },
        React.createElement(Text, null, "Ready"),
        React.createElement(Text, { dim: true }, "to assist")
      ),
      React.createElement(
        Column,
        { gap: 1 },
        React.createElement(Text, { variant: "subtitle" }, "Examples:"),
        React.createElement(Text, { variant: "mono" }, "console.log('Hello, world!')"),
        React.createElement(Text, { dim: true, bold: true }, "This is a dimmed bold text"),
        React.createElement(
          Text,
          { wrap: true },
          "This is a long text that should wrap to the next line when it reaches the end of the terminal width."
        )
      )
    )
  );
};

export default App;

// Only run if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  render(React.createElement(App));
}