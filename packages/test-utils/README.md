# @sage/test-utils

> "The Controlled Environment."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

`@sage/test-utils` provides batteries-included utilities for **fast, isolated, reproducible** tests across the SAGE monorepo. It ships temp-FS harnesses, in-memory adapters for Graph/Chronicle/LLM/Tools, deterministic clocks & RNG, CLI and Daemon simulators, and assertion helpers tailored to SAGE's **Principles & Protocols**.

The package is designed to ensure determinism by default with stable clocks, seeded RNG, and hermetic IO. It enables fast testing with no disk/network unless explicitly enabled and provides ergonomic APIs with minimal boilerplate to stand up agents/flows with good defaults.

## Installation

```bash
pnpm add -D @sage/test-utils
```

## Quick Start

```typescript
import {
  createTempWorkspace,
  writeFile,
  readFile,
  golden
} from '@sage/test-utils/fs';
import {
  makeGraphAdapter,
  makeChronicle,
  makeLLM,
  makeTools
} from '@sage/test-utils/adapters';

// Minimal, copy-pasteable example demonstrating primary use case
const ws = await createTempWorkspace();
await writeFile(ws, "src/UserService.ts", 'export const ping=()=>"pong"\n');

const graph = makeGraphAdapter();
const chron = makeChronicle();
const llm = makeLLM({ seed: 42 });
const tools = makeTools({ readOnly: true });

// Golden snapshot the Chronicle after a fake event
await chron.append("src/UserService.ts.sage", {
  type: "PLAN_APPROVED",
  timestamp: "2025-08-28T00:00:00.000Z",
  actor: { agent: "guardian", id: "src/UserService.ts" },
  planHash: "deadbeef"
});

await golden(ws, "src/UserService.ts.sage");
```

## Core API

### Test Utilities API

The main modules and functions for testing SAGE packages:

```typescript
// Key method signatures with examples
// Temp FS & Workspace Harnesses
class TempFS {
  /**
   * Create a temporary filesystem for testing
   */
  static async createTempWorkspace(options?: {
    prefix?: string;
    clock?: Clock;
  }): Promise<TempWorkspace> {
    // Create a temporary workspace
  }
}

// In-Memory Adapters
class Adapters {
  /**
   * Create an in-memory Graph adapter
   */
  static makeGraphAdapter(): GraphAdapter {
    // Create a Graph adapter
  }

  /**
   * Create an in-memory Chronicle adapter
   */
  static makeChronicle(): ChronicleAdapter {
    // Create a Chronicle adapter
  }

  /**
   * Create a deterministic LLM adapter
   */
  static makeLLM(options?: {
    seed?: number;
    tools?: Record<string, ToolExecutor>;
  }): LLMClient {
    // Create an LLM adapter
  }

  /**
   * Create a tools adapter
   */
  static makeTools(options?: {
    readOnly?: boolean;
  }): ToolRegistry {
    // Create a tools adapter
  }
}

// Agent Scenario DSL & Harnesses
class ScenarioDSL {
  /**
   * Create a test scenario
   */
  static async scenario(): Promise<Scenario> {
    // Create a test scenario
  }
}

// Protocol Matchers & Assertions
class Matchers {
  /**
   * Setup custom matchers for Vitest/Jest
   */
  static setupMatchers(): void {
    // Setup custom matchers
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and deterministic utilities

### Dependents  
- **All SAGE packages** — Used for testing across the entire SAGE ecosystem
- **[@sage/agents](../agents/README.md)** — Agent testing with scenario DSL
- **[@sage/graph](../graph/README.md)** — Graph testing with in-memory adapters
- **[@sage/chronicle](../chronicle/README.md)** — Chronicle testing with append-only adapters
- **[@sage/llm](../llm/README.md)** — LLM testing with deterministic adapters
- **[@sage/tools](../tools/README.md)** — Tools testing with sandboxed fakes

## Development Status

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

The test-utils package is currently in development with core APIs defined and some implementations in progress. It provides essential testing infrastructure for the entire SAGE ecosystem.

**✅ Core Features Defined:**
- Temp FS & Workspace Harnesses specification
- In-Memory Adapters specification
- Agent Scenario DSL & Harnesses specification
- Protocol Matchers & Assertions specification

**⚠️ Implementation In Progress:**
- Temp FS & Workspace Harnesses implementation
- In-Memory Adapters implementation
- Agent Scenario DSL & Harnesses implementation
- Protocol Matchers & Assertions implementation

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

# Clean build artifacts
pnpm clean
```

## Contract

This package implements the **[Test Utils Contract](./CONTRACT.md)**, which defines:
- Temp FS & Workspace Harnesses for isolated filesystem testing
- In-Memory Adapters for deterministic testing of SAGE interfaces
- Agent Scenario DSL & Harnesses for end-to-end agent testing
- Protocol Matchers & Assertions for validating SAGE protocols

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
