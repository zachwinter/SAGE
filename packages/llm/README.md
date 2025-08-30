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

### With OpenAI

```typescript
import { createChatStream, setProvider } from '@sage/llm';
import { OpenAIAdapter } from '@sage/llm/adapters/openai';

// Configure OpenAI provider
const openaiAdapter = new OpenAIAdapter({ 
  apiKey: process.env.OPENAI_API_KEY! 
});

setProvider(openaiAdapter);

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

### With LM Studio

```typescript
import { createChatStream, setProvider } from '@sage/llm';
import { createDefaultLMStudioAdapter } from '@sage/llm/adapters/lmstudio-factory';

// Assuming you have LM Studio dependencies available
// This is a simplified example - you'll need to provide actual LM Studio deps
const lmStudioAdapter = createDefaultLMStudioAdapter(lmStudioDeps, 'llama3');

setProvider(lmStudioAdapter);

const stream = await createChatStream({
  model: "local-model",
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
import { createChatStream, setProvider, listModels } from '@sage/llm';

// Set the current provider
setProvider(provider);

// Create a chat stream with the current provider
const stream = await createChatStream({
  model: "gpt-4.1",
  messages: [
    { role: "user", content: "Hello, world!" }
  ]
});

// List available models from the current provider
const models = await listModels();
```

### Provider Adapters

The package includes adapters for various LLM providers:

```typescript
// OpenAI adapter
import { OpenAIAdapter } from '@sage/llm/adapters/openai';
const openai = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });

// Anthropic adapter
import { AnthropicAdapter } from '@sage/llm/adapters/anthropic';
const anthropic = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

// LM Studio adapter
import { createDefaultLMStudioAdapter } from '@sage/llm/adapters/lmstudio-factory';
const lmstudio = createDefaultLMStudioAdapter(lmStudioDeps, 'llama3');

// Test adapter for deterministic testing
import { TestProviderFactory } from '@sage/llm/adapters/test';
const testProvider = TestProviderFactory.simple('Hello, test!');
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

![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

The LLM package is production-ready with comprehensive provider support and advanced features.

**✅ Core Features Implemented:**
- Unified chat API with tool-calling
- Streaming support with backpressure handling
- JSON Schema validation for tools
- Prompt caching with multiple modes
- Error handling and safety features
- Comprehensive provider adapters (OpenAI, Anthropic, LM Studio, MCP, Test)

**✅ Advanced Features:**
- Event normalization for consistent provider behavior
- Security policies and tool validation
- Detailed telemetry and monitoring
- Configurable backpressure handling
- Provider-agnostic API with consistent interfaces

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
