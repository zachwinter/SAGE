# @sage/ui - Implementation Status

## Package Purpose
Renderer-agnostic UI primitives supporting both CLI (Ink) and Web (React DOM) with streaming chat components.

## Current Implementation Status

### ✅ Core Primitives (Completed)
- `Text` - Text component with variant styling
- `Row` - Horizontal layout component
- `Column` - Vertical layout component
- `Box` - Container component with padding/margin/border

### ✅ Streaming Components (Interface Defined)
- `Chat` - Renders a conversation stream
- `AssistantTurn` - Assistant message wrapper
- `UserMessage` - User message wrapper
- `ToolCall` - Tool invocation visualization
- `Spinner` - Loading indicator

### ✅ Theme System (Completed)
- `ThemeProvider` - Theme context provider
- `defaultTheme` - Default theme configuration
- Theme tokens mapped to both CLI and Web renderers

### ✅ Renderer Adapters (Interface Defined)
- CLI adapter entry point (`@sage/ui/cli`)
- Web adapter entry point (`@sage/ui/web`)
- Adapter interfaces for both platforms

## Contract Requirements (from CONTRACT.md)

### Core Primitives
```ts
export interface TextProps { 
  variant?: "title"|"subtitle"|"body"|"mono"; 
  dim?: boolean; 
  bold?: boolean; 
  wrap?: boolean; 
  children?: any 
}

export interface RowProps { 
  gap?: number; 
  align?: Align; 
  justify?: Align; 
  children?: any 
}

export interface ColumnProps { 
  gap?: number; 
  align?: Align; 
  justify?: Align; 
  children?: any 
}

export interface BoxProps { 
  padding?: number; 
  margin?: number; 
  border?: boolean; 
  rounded?: boolean; 
  children?: any 
}

export const Text: (p: TextProps) => any;
export const Row: (p: RowProps) => any;
export const Column: (p: ColumnProps) => any;
export const Box: (p: BoxProps) => any;
```

### Streaming Components
```ts
export interface StreamEvent = import("@sage/llm").StreamEvent;

export const Chat: (props: { stream: AsyncIterable<StreamEvent>; children?: any }) => any;
export const AssistantTurn: (props?: Record<string, any>) => any;
export const UserMessage: (props: { children?: any }) => any;
```

## Architecture
```
App Code ──▶ @sage/ui primitives ──▶ Renderer Adapter (cli | web)
                                  └▶ Theme (tokens)
```

### Renderer Adapters
- **CLI Adapter**: wraps primitives with Ink components
- **Web Adapter**: wraps primitives with React DOM (div/span) and CSS

```ts
// CLI entry
import { createCLIAdapter } from "@sage/ui/adapters/cli";
export const UI = createCLIAdapter();

// Web entry  
import { createWebAdapter } from "@sage/ui/adapters/web";
export const UI = createWebAdapter();
```

## Key Requirements
- **Renderer-agnostic**: No direct Ink or DOM imports in app code
- **Streaming-ready**: Components accept async iterables for progressive updates
- **Consistent rendering**: Same component behavior across CLI and Web
- **Theme support**: Shared theme tokens applied per renderer
- **Accessibility**: ARIA on Web, TTY-friendly fallbacks on CLI

## Theme System
```ts
export interface Theme {
  colors: { primary: string; dim: string; [key: string]: string };
  spacing: { xs: number; sm: number; md: number; lg: number };
  borders: { radius: number };
}

export const ThemeProvider: (props: { value: Theme; children: any }) => any;
```

## Integration with @sage/llm
- `<Chat>` component consumes `AsyncIterable<StreamEvent>` 
- Renders streaming tokens and tool calls progressively
- Tool call visualization with live results
- Backpressure handling via async iteration

## Testing Strategy
- Components are pure React, testable with React Testing Library
- Snapshot both adapters to ensure CLI/Web parity
- Mock streaming events for deterministic tests

## Dependencies
- React (peer dependency)
- `@sage/llm` for StreamEvent types

## Next Steps
1. Implement CLI adapter with actual Ink components
2. Implement Web adapter with React DOM components
3. Add comprehensive integration tests
4. Create example applications demonstrating usage