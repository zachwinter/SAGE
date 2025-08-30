import React from 'react';
import { render } from 'ink';
import { Text, Row, Column, Box, ThemeProvider } from '../cli.js';
import { defaultTheme } from '../theme.js';

const ComprehensiveExample = () => {
  return React.createElement(
    ThemeProvider,
    { value: defaultTheme },
    React.createElement(
      Column,
      { gap: 1 },
      // Title
      React.createElement(
        Row,
        { justify: "center" },
        React.createElement(Text, { variant: "title" }, "SAGE UI Components Demo")
      ),
      
      // Text variants
      React.createElement(
        Box,
        { border: true, padding: 1 },
        React.createElement(Text, { variant: "subtitle" }, "Text Variants:"),
        React.createElement(
          Column,
          { gap: 1, padding: 1 },
          React.createElement(Text, { variant: "title" }, "Title Text"),
          React.createElement(Text, { variant: "subtitle" }, "Subtitle Text"),
          React.createElement(Text, { variant: "body" }, "Body Text"),
          React.createElement(Text, { variant: "mono" }, "Mono Text: console.log('Hello')"),
          React.createElement(Text, { dim: true }, "Dimmed Text"),
          React.createElement(Text, { bold: true }, "Bold Text"),
          React.createElement(
            Text,
            { wrap: true },
            "This is a long text that should wrap to multiple lines when it reaches the end of the terminal width. It demonstrates the wrapping functionality of our Text component."
          )
        )
      ),
      
      // Layout components
      React.createElement(
        Box,
        { border: true, padding: 1 },
        React.createElement(Text, { variant: "subtitle" }, "Layout Components:"),
        React.createElement(
          Column,
          { gap: 1, padding: 1 },
          React.createElement(Text, null, "Row with gap:"),
          React.createElement(
            Row,
            { gap: 2 },
            React.createElement(Text, { variant: "body" }, "Item 1"),
            React.createElement(Text, { variant: "body" }, "Item 2"),
            React.createElement(Text, { variant: "body" }, "Item 3")
          ),
          React.createElement(Text, null, "Column with gap:"),
          React.createElement(
            Column,
            { gap: 1 },
            React.createElement(Text, { variant: "body" }, "Line 1"),
            React.createElement(Text, { variant: "body" }, "Line 2"),
            React.createElement(Text, { variant: "body" }, "Line 3")
          )
        )
      ),
      
      // Box variations
      React.createElement(
        Box,
        { border: true, padding: 1 },
        React.createElement(Text, { variant: "subtitle" }, "Box Variations:"),
        React.createElement(
          Row,
          { gap: 2 },
          React.createElement(
            Box,
            { border: true, padding: 1 },
            React.createElement(Text, null, "Bordered Box")
          ),
          React.createElement(
            Box,
            { padding: 1 },
            React.createElement(Text, null, "Plain Box")
          ),
          React.createElement(
            Box,
            { border: true, rounded: true, padding: 1 },
            React.createElement(Text, null, "Rounded Box")
          )
        )
      ),
      
      // Alignment examples
      React.createElement(
        Box,
        { border: true, padding: 1 },
        React.createElement(Text, { variant: "subtitle" }, "Alignment Examples:"),
        React.createElement(
          Column,
          { gap: 1 },
          React.createElement(
            Box,
            { border: true, padding: 1 },
            React.createElement(Text, null, "Left Aligned (default)")
          ),
          React.createElement(
            Row,
            { justify: "center" },
            React.createElement(
              Box,
              { border: true, padding: 1 },
              React.createElement(Text, null, "Center Aligned")
            )
          ),
          React.createElement(
            Row,
            { justify: "end" },
            React.createElement(
              Box,
              { border: true, padding: 1 },
              React.createElement(Text, null, "Right Aligned")
            )
          )
        )
      )
    )
  );
};

export default ComprehensiveExample;

// Only run if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  render(React.createElement(ComprehensiveExample));
}