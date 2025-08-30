import React from 'react';
import {
  Text as InkText,
  Box as InkBox,
  Spacer
} from 'ink';
import { defaultTheme } from '../../theme.js';

// Text component implementation
const Text: React.FC<{
  variant?: 'title' | 'subtitle' | 'body' | 'mono';
  dim?: boolean;
  bold?: boolean;
  wrap?: boolean;
  children?: React.ReactNode;
}> = ({ variant, dim, bold, wrap, children }) => {
  // Map variants to styling
  const color = dim ? defaultTheme.colors.dim : undefined;
  const isBold = bold ? true : false;
  
  // Handle wrap
  const textWrap = wrap ? 'wrap' : 'truncate';
  
  switch (variant) {
    case 'title':
      return React.createElement(
        InkText,
        { bold: true, color: defaultTheme.colors.primary, wrap: textWrap },
        children
      );
    case 'subtitle':
      return React.createElement(
        InkText,
        { bold: true, dimColor: true, wrap: textWrap },
        children
      );
    case 'mono':
      return React.createElement(
        InkText,
        { backgroundColor: "black", color: "white", wrap: textWrap },
        children
      );
    case 'body':
    default:
      return React.createElement(
        InkText,
        { color, bold: isBold, wrap: textWrap },
        children
      );
  }
};

// Row component implementation (horizontal layout)
const Row: React.FC<{
  gap?: number;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
  children?: React.ReactNode;
}> = ({ gap = 0, align = 'start', justify = 'start', children }) => {
  // Convert children to array for easier manipulation
  const childArray = React.Children.toArray(children);
  
  // Add gap elements between children
  const childrenWithGaps = childArray.reduce<React.ReactNode[]>((acc, child, index) => {
    acc.push(child);
    // Add gap after each child except the last one
    if (index < childArray.length - 1 && gap > 0) {
      acc.push(React.createElement(Spacer, { key: `gap-${index}`, x: gap }));
    }
    return acc;
  }, []);
  
  // Handle alignment
  let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'flex-start';
  switch (justify) {
    case 'center':
      justifyContent = 'center';
      break;
    case 'end':
      justifyContent = 'flex-end';
      break;
  }
  
  let alignItems: 'flex-start' | 'center' | 'flex-end' = 'flex-start';
  switch (align) {
    case 'center':
      alignItems = 'center';
      break;
    case 'end':
      alignItems = 'flex-end';
      break;
  }
  
  return React.createElement(
    InkBox,
    { flexDirection: "row", justifyContent, alignItems },
    ...childrenWithGaps
  );
};

// Column component implementation (vertical layout)
const Column: React.FC<{
  gap?: number;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
  children?: React.ReactNode;
}> = ({ gap = 0, align = 'start', justify = 'start', children }) => {
  // Convert children to array for easier manipulation
  const childArray = React.Children.toArray(children);
  
  // Add gap elements between children
  const childrenWithGaps = childArray.reduce<React.ReactNode[]>((acc, child, index) => {
    acc.push(child);
    // Add gap after each child except the last one
    if (index < childArray.length - 1 && gap > 0) {
      acc.push(React.createElement(Spacer, { key: `gap-${index}`, y: gap }));
    }
    return acc;
  }, []);
  
  // Handle alignment
  let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'flex-start';
  switch (justify) {
    case 'center':
      justifyContent = 'center';
      break;
    case 'end':
      justifyContent = 'flex-end';
      break;
  }
  
  let alignItems: 'flex-start' | 'center' | 'flex-end' = 'flex-start';
  switch (align) {
    case 'center':
      alignItems = 'center';
      break;
    case 'end':
      alignItems = 'flex-end';
      break;
  }
  
  return React.createElement(
    InkBox,
    { flexDirection: "column", justifyContent, alignItems },
    ...childrenWithGaps
  );
};

// Box component implementation
const Box: React.FC<{
  padding?: number;
  margin?: number;
  border?: boolean;
  rounded?: boolean;
  children?: React.ReactNode;
}> = ({ padding = 0, margin = 0, border = false, rounded = false, children }) => {
  return React.createElement(
    InkBox,
    {
      padding,
      margin,
      borderChar: border ? undefined : ' ',
      borderColor: border ? defaultTheme.colors.primary : undefined,
      borderStyle: border ? (rounded ? 'round' : 'single') : undefined
    },
    children
  );
};

// ThemeProvider implementation
const ThemeProvider: React.FC<{
  value: typeof defaultTheme;
  children: React.ReactNode;
}> = ({ value, children }) => {
  // In a real implementation, we would use React Context here
  // For now, we'll just pass through the children
  return React.createElement(React.Fragment, null, children);
};

// Export all components
export const createCLIAdapter = () => {
  return {
    Text,
    Row,
    Column,
    Box,
    ThemeProvider,
    // Placeholder implementations for streaming components
    Chat: () => null,
    AssistantTurn: () => null,
    UserMessage: () => null,
    ToolCall: () => null,
    Spinner: () => null,
  };
};

export default createCLIAdapter;