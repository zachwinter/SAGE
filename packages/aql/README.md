# @sage/aql

> "The Declarative Orchestrator."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

**AQL (Agent/Action Query Language)** is a GraphQL-inspired, strongly-typed DSL for orchestrating **agent workflows and tool executions**. You declare _what_ you want; AQL plans _how_ to do it: sequencing, parallelism, retries, and dataflow management.

AQL serves as a **high-level workflow language** that compiles into executable plans. These plans can be executed against any compatible agent execution system, making AQL a universal language for declarative workflow orchestration.

## Installation

```bash
pnpm add @sage/aql
```

## Quick Start

```typescript
import { AQL } from '@sage/aql';
import { readFileSync } from 'fs';

// Minimal, copy-pasteable example demonstrating primary use case
const aql = new AQL();
await aql.initialize();

const src = readFileSync('examples/basic/hello-world.aql', 'utf8');
const result = await aql.run(src, { name: 'World' });

console.log('Greeting:', result.results.greeting);
```

## Core API

### AQL

The main class for parsing and executing AQL queries.

```typescript
// Key method signatures with examples
class AQL {
  async initialize(): Promise<void> {
    // Initialize the AQL engine
  }

  parseQuery(aqlSource: string): AQLQuery {
    // Parse an AQL source string into a query object
  }

  async executeQuery(query: AQLQuery, variables: Record<string, any> = {}): Promise<ExecutionResult> {
    // Execute a parsed query with provided variables
  }

  async run(aqlSource: string, variables: Record<string, any> = {}): Promise<ExecutionResult> {
    // Parse and execute an AQL source string
  }

  setDebug(debug: boolean): void {
    // Enable or disable debug mode
  }

  setTimeout(timeout: number): void {
    // Set execution timeout in milliseconds
  }

  setRetries(retries: number): void {
    // Set number of retries for failed operations
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/graph](../graph/README.md)** — Planned integration for querying code structure during workflow execution
- **[@sage/llm](../llm/README.md)** — Future integration for executing agent operations through LLM providers
- **[@sage/tools](../tools/README.md)** — Planned integration for executing tool operations within workflows

### Dependents  
- **[@sage/agents](../agents/README.md)** — Future integration where the Delegator will translate Plans into AQL queries for execution

## Development Status

![Status: Prototype](https://img.shields.io/badge/Status-Prototype-orange)

AQL is currently in the prototype phase. It features a functional regex-based parser and a conceptual execution engine that can map dependencies. However, it is not yet fully integrated with the SAGE ecosystem and does not perform real agent or tool executions. The current implementation is experimental and subject to significant changes as we work toward a production-ready version.

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
pnpm typecheck
```

## Contract

This package implements the **[AQL Contract](./CONTRACT.md)**, which defines:
- Strong typing with compile-time validation of dataflow and tool arguments
- Deterministic planning with explicit execution plans (DAGs)
- Framework-agnostic execution that works with different agent systems

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
