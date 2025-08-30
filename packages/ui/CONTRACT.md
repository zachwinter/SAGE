# UI Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/ui` package.

## Overview

`@sage/ui` is a **renderer-agnostic** UI kit for SAGE. It exports **platform-neutral primitives** — `Text`, `Row`, `Column`, `Box`, etc. — and maps them to concrete renderers (CLI via Ink, Web via React DOM) behind the scenes. Components written against these primitives don't know (or care) whether they're in a terminal or a browser.

This contract specifies the expected behavior, interfaces, and guarantees that the UI implementation must provide.

## Core Guarantees

### Renderer-Agnostic

- No direct Ink or DOM imports in app code
- Components work consistently across CLI and Web renderers
- Renderer-specific logic is contained within adapters
- Same component code runs unchanged on both platforms

### Streaming-Ready

- Components accept async iterables and progressive updates
- Real-time rendering of streaming content
- Proper handling of incomplete or delayed data
- Smooth user experience during streaming operations

### Accessible by Default

- Reasonable roles/ARIA on Web for screen readers
- TTY-friendly fallbacks on CLI for terminal users
- Keyboard navigation support
- Semantic HTML structure on Web

### Themeable

- Shared theme object (tokens) applied consistently per renderer
- Customizable color schemes, spacing, and typography
- Runtime theme switching capabilities
- CSS variable mapping on Web, Ink style mapping on CLI

## Interface Specifications

### Core Primitives

```typescript
// Alignment types
export type Align = "start" | "center" | "end";

// Primitive component props
export interface TextProps {
  /** Text variant styling */
  variant?: "title" | "subtitle" | "body" | "mono";
  /** Dim the text */
  dim?: boolean;
  /** Bold text */
  bold?: boolean;
  /** Wrap text */
  wrap?: boolean;
  /** Text content */
  children?: ReactNode;
}

export interface RowProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: Align;
  /** Alignment of children along the main axis */
  justify?: Align;
  /** Row content */
  children?: ReactNode;
}

export interface ColumnProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: Align;
  /** Alignment of children along the main axis */
  justify?: Align;
  /** Column content */
  children?: ReactNode;
}

export interface BoxProps {
  /** Padding around content */
  padding?: number;
  /** Margin around the box */
  margin?: number;
  /** Show border */
  border?: boolean;
  /** Rounded corners */
  rounded?: boolean;
  /** Box content */
  children?: ReactNode;
}
```

### Higher-Level Components

```typescript
export interface ChatProps {
  /** Stream of events from @sage/llm */
  stream: AsyncIterable<StreamEvent>;
  /** Chat content */
  children?: ReactNode;
}

export interface AssistantTurnProps {
  /** Assistant turn content */
  children?: ReactNode;
}

export interface UserMessageProps {
  /** User message content */
  children?: ReactNode;
}

export interface ToolCallProps {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: any;
  /** Tool call result */
  result?: any;
}

export interface SpinnerProps {
  /** Spinner content */
  children?: ReactNode;
}
```

### Theme System

```typescript
export interface Theme {
  colors: {
    primary: string;
    dim: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    text: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
  borders: {
    radius: number;
    width: number;
  };
  typography: {
    fontSize: {
      title: number;
      subtitle: number;
      body: number;
      mono: number;
    };
    fontFamily: {
      sans: string;
      mono: string;
    };
  };
}

export interface ThemeProviderProps {
  value: Theme;
  children: ReactNode;
}
```

## Architecture

### Renderer Adapters

The UI package uses a adapter-based architecture to support multiple renderers:

```
App Code ─▶ @sage/ui primitives ─▶ Renderer Adapter (cli | web)
                                 └▶ Theme (tokens)
```

#### CLI Adapter

- Wraps primitives with Ink under the hood
- Maps theme tokens to Ink styles
- Provides TTY-friendly fallbacks
- Handles terminal-specific interactions

#### Web Adapter

- Wraps primitives with React DOM (div/span) and CSS
- Maps theme tokens to CSS variables
- Provides ARIA roles for accessibility
- Handles browser-specific interactions

### Component Implementation

All higher-level components are implemented **only** in terms of primitives (`Text`, `Row`, `Column`, `Box`) so they stay renderer-agnostic.

## Primitives

### Text

The Text primitive provides styled text rendering:

- `variant`: 'title' | 'subtitle' | 'body' | 'mono'
- `dim`: Boolean to dim the text
- `bold`: Boolean for bold text
- `wrap`: Boolean to control text wrapping

### Row

The Row primitive provides horizontal layout:

- `gap`: Number for spacing between children
- `align`: Alignment along the cross axis ('start' | 'center' | 'end')
- `justify`: Alignment along the main axis ('start' | 'center' | 'end')

### Column

The Column primitive provides vertical layout:

- `gap`: Number for spacing between children
- `align`: Alignment along the cross axis ('start' | 'center' | 'end')
- `justify`: Alignment along the main axis ('start' | 'center' | 'end')

### Box

The Box primitive provides container styling:

- `padding`: Number for padding around content
- `margin`: Number for margin around the box
- `border`: Boolean to show border
- `rounded`: Boolean for rounded corners

## Higher-Level Components

### Chat

Renders a conversation stream accepting `AsyncIterable<StreamEvent>` from `@sage/llm`:

- Real-time rendering of streaming content
- Proper handling of different event types
- Smooth scrolling and focus management
- Error handling and recovery

### AssistantTurn / UserMessage

Message wrappers for assistant and user messages:

- Distinct styling for different message types
- Proper attribution and ordering
- Support for rich content types
- Accessibility features

### ToolCall

Shows tool invocations with live results:

- Clear display of tool name and arguments
- Real-time updating of tool results
- Error state handling
- Collapsible/expandable sections

### Spinner

Renderer-appropriate busy indicator:

- Platform-specific spinner animations
- Consistent sizing and positioning
- Accessible loading indicators
- Customizable appearance

## Theming

### Theme Tokens

The theme system uses a shared theme object with tokens for:

- Colors: primary, dim, success, warning, error, background, text
- Spacing: xs, sm, md, lg
- Borders: radius, width
- Typography: fontSize, fontFamily

### Theme Provider

The ThemeProvider component allows runtime theme switching:

- Context-based theme distribution
- Default theme fallbacks
- Theme merging capabilities
- Performance-optimized updates

## Streaming Patterns

### Async Iterable Support

Components accept `AsyncIterable<StreamEvent>` for real-time rendering:

- Proper handling of incomplete or delayed data
- Memory-efficient rendering of large streams
- Graceful error handling and recovery
- Cleanup of resources on unmount

### Event Handling

Different event types from `@sage/llm` are handled appropriately:

- Text events render as streaming text
- Tool call events render as tool invocation UI
- Tool result events update tool call UI
- Error events render as error messages

## Usage Patterns

### Adapter Selection

Choose an adapter once at your app's entrypoint:

```tsx
// CLI entry (apps/cli)
import { render } from "ink";
import { UI } from "@sage/ui/cli"; // uses Ink under the hood

render(<UI.App />);

// Web entry (future dev server)
import { createRoot } from "react-dom/client";
import { UI } from "@sage/ui/web"; // uses React DOM under the hood

createRoot(document.getElementById("root")!).render(<UI.App />);
```

### Component Composition

Prefer `Row`/`Column` composition over ad-hoc layout props:

```tsx
// Good - Clear composition
<Column gap={1}>
  <Row gap={1} align="center">
    <Text variant="title">Title</Text>
    <Text dim>Subtitle</Text>
  </Row>
  <Text>Content</Text>
</Column>

// Avoid - Ad-hoc layout
<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <span style={{ fontSize: 24 }}>Title</span>
    <span style={{ opacity: 0.6 }}>Subtitle</span>
  </div>
  <p>Content</p>
</div>
```

## Testing

### Component Testing

- Components are pure React and testable with React Testing Library
- Snapshot both adapters to ensure parity across CLI/Web renderers
- Test accessibility features with axe-core or similar tools
- Verify streaming behavior with mock async iterables

### Adapter Testing

- Test adapter implementations separately
- Verify theme token mapping
- Ensure consistent rendering across platforms
- Test edge cases and error conditions

## Advanced Features

### Custom Primitives

The system supports extending with custom primitives:

```typescript
interface CustomComponentProps {
  // Custom props
}

const CustomComponent = (props: CustomComponentProps) => {
  // Implementation using existing primitives
  return (
    <Box border padding={1}>
      <Text variant="body">{props.children}</Text>
    </Box>
  );
};
```

### Dynamic Theming

Runtime theme switching with smooth transitions:

```tsx
const ThemedApp = () => {
  const [theme, setTheme] = useState(lightTheme);
  
  return (
    <ThemeProvider value={theme}>
      <App />
      <button onClick={() => setTheme(theme === lightTheme ? darkTheme : lightTheme)}>
        Toggle Theme
      </button>
    </ThemeProvider>
  );
};
```

### Responsive Design

Adaptive layouts that work across different screen sizes:

```tsx
const ResponsiveLayout = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  return isMobile ? (
    <Column gap={1}>
      <Content />
    </Column>
  ) : (
    <Row gap={2}>
      <Sidebar />
      <Content />
    </Row>
  );
};
```

## Future Extensions

This contract may be extended as UI evolves to include:

- Additional primitives for common UI patterns
- Advanced theming capabilities with dark mode support
- Internationalization and localization features
- Animation and transition support
- Advanced layout primitives (Grid, Flex, etc.)
- Integration with design system libraries
- Enhanced accessibility features
- Performance optimizations for large component trees