# @sage/llm

> "The Engine of Thought."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

`@sage/llm` is the provider-agnostic bridge to Large Language Models. It standardizes chat, tool-use, and streaming across backends (LM Studio, OpenAI, Anthropic, etc.), so agents focus on **what** to think, not **how** to call models.

The package provides a resilient, performant abstraction that exposes a **unified chat API** with tool-calling, supports **streaming** tokens and **structured tool calls**, delivers **prompt caching** and **response de-duplication**, enforces **safety caps** (rate limits, token budgets, timeouts), and keeps **providers pluggable** via a clean interface.

## Installation

```bash
pnpm add @sage/llm
```

## Quick Start

```typescript
import { createChatStream, setProvider } from '@sage/llm';
import { OpenAIProvider } from '@sage/llm/adapters/openai'; // example adapter

// Minimal, copy-pasteable example demonstrating primary use case
setProvider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }));

const stream = await createChatStream({
  model: "gpt-4.1",
  messages: [
    { role: "system", content: "You are a helpful agent." },
    { role: "user", content: "List three risks of unsafe refactors." }
  ]
});

for await (const ev of stream) {
  if (ev.type === "text") process.stdout.write(ev.value);
}
```

## Core API

### LLM API Functions

The main functions for interacting with LLM providers:

```typescript
// Key method signatures with examples
class LLM {
  /**
   * Create a chat stream with the current provider, with optional caching
   */
  async createChatStream(
    opts: ChatOptions,
    streamOpts?: StreamOptions
  ): Promise<AsyncIterable<StreamEvent>> {
    // Create a chat stream
  }

  /**
   * List available models from the current provider or a specific provider
   */
  async listModels(provider?: string): Promise<ModelInfo[]> {
    // List available models
  }

  /**
   * Set the current provider
   */
  setProvider(provider: LLMProvider): void {
    // Set the current provider
  }

  /**
   * Register a tool for use with LLM calls
   */
  registerTool(
    name: string,
    schema: ToolSchema,
    executor: ToolExecutor
  ): void {
    // Register a tool
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and utilities
- **[@sage/mcp](../mcp/README.md)** — Integration with Model Context Protocol for enterprise-grade LLM management

### Dependents  
- **[@sage/agents](../agents/README.md)** — Agents use LLM for thinking & mediation
- **[@sage/aql](../aql/README.md)** — AQL compiles declarative queries into executions that stream through this API
- **[CLI applications](../../apps/cli/README.md)** — CLI uses LLM for chat UX

## Development Status

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

The LLM package is currently in development with core features implemented and ready for production use. Some advanced features and provider adapters are still in progress.

**✅ Core Features Implemented:**
- Unified chat API with tool-calling
- Streaming support with backpressure handling
- JSON Schema validation for tools
- Prompt caching with multiple modes
- Error handling and safety features

**⚠️ In Progress:**
- Provider adapter completion (OpenAI, Anthropic, LM Studio)
- Production readiness and polish
- @sage/mcp integration

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

This package implements the **[LLM Contract](./CONTRACT.md)**, which defines:
- Provider-agnostic unified chat API
- Streaming tokens and structured tool calls
- Prompt caching and response de-duplication
- Safety caps (rate limits, token budgets, timeouts)

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
