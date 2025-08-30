# @sage/ui

> "The Voice of the System."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

`@sage/ui` is a **renderer-agnostic** UI kit for SAGE. It exports **platform-neutral primitives** — `Text`, `Row`, `Column`, `Box`, etc. — and maps them to concrete renderers (CLI via Ink, Web via React DOM) behind the scenes. Components written against these primitives don't know (or care) whether they're in a terminal or a browser.

The package provides a single component model that renders **consistently across CLI and Web**, supports **streaming** assistant output and tool calls, exposes a **headless** API for complex widgets with pluggable skins, and keeps **layout & typography primitives** stable across renderers.

## Installation

```bash
pnpm add @sage/ui
```

## Quick Start

```typescript
import { Text, Row, Column, Box } from '@sage/ui';

// Minimal, copy-pasteable example demonstrating primary use case
// Layout primitives auto-map to Ink or DOM
const App = () => (
  <Column gap={1}>
    <Row gap={1} align="center" justify="space-between">
      <Text variant="title">SAGE</Text>
      <Text dim>v1.0.0</Text>
    </Row>
    
    <Text>Hello, world.</Text>
    
    <Box border padding={1}>
      <Text mono>code or logs...</Text>
    </Box>
  </Column>
);

// Choose an adapter once at your app's entrypoint
// CLI entry (apps/cli)
import { render } from "ink";
import { UI } from "@sage/ui/cli"; // uses Ink under the hood

render(<UI.App />);

// Web entry (future dev server)
import { createRoot } from "react-dom/client";
import { UI } from "@sage/ui/web"; // uses React DOM under the hood

createRoot(document.getElementById("root")!).render(<UI.App />);
```

## Core API

### UI Primitives

The main primitives for building UI components:

```typescript
// Key method signatures with examples
interface TextProps {
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

interface RowProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: "start" | "center" | "end";
  /** Alignment of children along the main axis */
  justify?: "start" | "center" | "end";
  /** Row content */
  children?: ReactNode;
}

interface ColumnProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: "start" | "center" | "end";
  /** Alignment of children along the main axis */
  justify?: "start" | "center" | "end";
  /** Column content */
  children?: ReactNode;
}

interface BoxProps {
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

Streaming components for chat and assistant interactions:

```typescript
interface ChatProps {
  /** Stream of events from @sage/llm */
  stream: AsyncIterable<StreamEvent>;
  /** Chat content */
  children?: ReactNode;
}

interface AssistantTurnProps {
  /** Assistant turn content */
  children?: ReactNode;
}

interface UserMessageProps {
  /** User message content */
  children?: ReactNode;
}

interface ToolCallProps {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: any;
  /** Tool call result */
  result?: any;
}

interface SpinnerProps {
  /** Spinner content */
  children?: ReactNode;
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[React](https://react.dev)** — Core UI library for component rendering
- **[Ink](https://github.com/vadimdemedes/ink)** — CLI renderer for terminal interfaces
- **[@sage/llm](../llm/README.md)** — Provides stream events for chat components

### Dependents  
- **[CLI applications](../../apps/cli/README.md)** — CLI uses UI components for terminal interfaces
- **Future web applications** — Web apps will use UI components for browser interfaces

## Development Status

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

The UI package is currently in the early stages of development with core primitives and streaming components defined.

**✅ Core Features Defined:**
- Core primitives (Text, Row, Column, Box)
- Streaming component interfaces (Chat, AssistantTurn, etc.)
- Theme system
- Build system configured
- Basic tests implemented

**⚠️ Implementation In Progress:**
- Adapter implementations (Ink/Web)
- Comprehensive examples
- Advanced component implementations

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build

# Run CLI example
pnpm example:cli

# Run comprehensive example
pnpm example:comprehensive
```

## Contract

This package implements the **[UI Contract](./CONTRACT.md)**, which defines:
- Renderer-agnostic UI primitives for consistent CLI and Web rendering
- Streaming components for assistant output and tool calls
- Themeable components with shared theme tokens
- Stable layout and typography primitives across renderers

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*