# @sage/tools

> "The Hands of the Agents."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

`@sage/tools` is a sandboxed, type-safe capability layer for SAGE agents. Each tool is a **well-defined, auditable action** with strongly-typed inputs and outputs. Tools are invoked via a central **registry** and described with **JSON Schema** for LLM tool-calling.

The package provides a secure bridge from **intent → effect** that validates inputs before execution, isolates execution in controllable sandboxes, reports structured results and errors, and supports dry-runs and capability discovery at runtime.

## Installation

```bash
pnpm add @sage/tools
```

## Quick Start

```typescript
import { toolRegistry, Read, Write, Edit, GraphQuery } from '@sage/tools';

// Minimal, copy-pasteable example demonstrating primary use case
// Register standard tools
toolRegistry.register(Read());
toolRegistry.register(Write());
toolRegistry.register(Edit());
toolRegistry.register(GraphQuery);

// Use a tool to read a file
const readTool = toolRegistry.get("Read");
const result = await readTool.execute(
  { file: "src/index.ts" }, 
  { 
    cwd: process.cwd(),
    fileSystem: realFileSystem, // Inject real file system operations
    process: realProcess,       // Inject real process operations
    logger: realLogger          // Inject logger
  }
);

if (result.ok) {
  console.log("File contents:", result.data);
} else {
  console.error("Error reading file:", result.error);
}
```

## Core API

### Tool Interface

The main interface for defining and using tools:

```typescript
// Key method signatures with examples
interface Tool<I, O> {
  name: string;
  description?: string;
  schema: JSONSchema; // for LLM tool-calls
  validate(input: unknown): I; // Zod runtime validation
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
  version?: string; // semantic version per tool
}

interface ToolContext {
  cwd: string;
  env?: Record<string, string>;
  dryRun?: boolean;
  permissions?: string[]; // e.g., ["fs:read", "fs:write:src/**"]
  logger?: (evt: ToolLog) => void;
  /**
   * An optional secret provider for just-in-time value injection.
   * If provided, the tool runner is responsible for placeholder substitution.
   */
  secretProvider?: import("@sage/utils").SecretProvider;
}

interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { startedAt: string; endedAt: string; durationMs: number };
}
```

### Tool Registry

The central registry for managing tools:

```typescript
class ToolRegistry {
  /**
   * Register a tool in the registry
   */
  register(tool: Tool<any, any>): void {
    // Register a tool
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool<any, any> {
    // Get a tool
  }

  /**
   * Get all tool schemas for LLM tool-calling
   */
  getToolSchemas(): ToolSchema[] {
    // Get tool schemas
  }
}
```

### Standard Tools

The package provides several standard tools:

```typescript
// Read - read file contents from the workspace
const readTool = Read();

// Write - write/replace file contents
const writeTool = Write();

// Edit - structured patch application with diff output
const editTool = Edit();

// GraphQuery - run read-only Cypher queries against @sage/graph
const graphQueryTool = GraphQuery;

// Bash - execute shell commands in a sandbox
const bashTool = Bash();
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/graph](../graph/README.md)** — Provides the GraphQuery tool for querying code structure
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and utilities
- **[@sage/mcp](../mcp/README.md)** — Integration with Model Context Protocol for advanced tool capabilities

### Dependents  
- **[@sage/agents](../agents/README.md)** — Agents use tools for executing actions (especially Delegator & Meeseeks)
- **[CLI applications](../../apps/cli/README.md)** — CLI uses tools for manual commands

## Development Status

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

The tools package is currently in development with core features implemented and ready for use. It provides a secure, sandboxed capability layer for SAGE agents.

**✅ Core Features Implemented:**
- Tool interface with type safety and validation
- Central tool registry for managing tools
- Standard tools: Read, Write, Edit, Bash, GraphQuery
- Security & sandboxing with process isolation and path policies
- Secret management with Vault-Warden Protocol integration

**⚠️ In Progress:**
- Additional tool implementations
- Enhanced security features
- Performance optimizations

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode  
pnpm test:watch

# Build the package
pnpm build

# Run type checking
pnpm type-check

# Lint the code
pnpm lint
```

## Contract

This package implements the **[Tools Contract](./CONTRACT.md)**, which defines:
- Sandboxed, type-safe capability layer for SAGE agents
- Secure bridge from intent to effect with validation and isolation
- Standard tool set with JSON Schema for LLM tool-calling
- Security & sandboxing with process isolation and path policies

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
