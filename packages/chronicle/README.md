# @sage/chronicle

> "The Sacred Memory."

## Overview

`@sage/chronicle` is SAGE's durable memory layer. It offers a simple, strongly-typed, **append-only** API for reading and writing `.sage` Chronicle files. Every material event in the ecology (approvals, denials, persona triggers, deployments, post-mortems) is recorded here for auditability and learning.

This package provides a **tamper-evident**, append-only event log that preserves **irreducible units of change** (diff pointers, justifications, metadata), links events to **Code Graph** commits and **Plan** hashes, supports **concurrency-safe** appends, and guarantees **ordering** and **traceability** across agents.

## Installation

```bash
pnpm add @sage/chronicle
```

## Quick Start

```typescript
import { readChronicle, appendEvent, type ChronicleEvent } from '@sage/chronicle';

// Minimal, copy-pasteable example demonstrating primary use case
const path = "/repo/src/UserService.ts.sage";

// Append an approval. The eventId will be computed automatically.
const evt: ChronicleEvent = {
  type: "PLAN_APPROVED",
  timestamp: new Date().toISOString(),
  planHash: "a1b2c3",
  graphCommit: "f6e5d4",
  actor: { agent: "guardian", id: "src/UserService.ts" },
  justification: "Refactor for performance; interfaces unchanged."
};

await appendEvent(path, evt);

// Read full history
const history = await readChronicle(path);
console.log(`History length: ${history.length}`);
```

## Core API

### Chronicle API Functions

The main functions for interacting with Chronicle files:

```typescript
// Key method signatures with examples
class ChronicleAPI {
  /**
   * Appends an event, automatically computing its eventId.
   * This is the standard, recommended method.
   */
  async appendEvent(
    path: ChroniclePath,
    evt: ChronicleEvent,
    lockTimeoutMs?: number
  ): Promise<void> {
    // Append an event to a Chronicle file
  }

  /**
   * Appends an event using a pre-computed eventId.
   * For advanced use cases like event sourcing or testing.
   */
  async appendEventWithId(
    path: ChroniclePath,
    evt: ChronicleEvent, // Must contain a valid eventId
    lockTimeoutMs?: number
  ): Promise<void> {
    // Append an event with a pre-computed eventId
  }

  async readChronicle(path: ChroniclePath): Promise<ChronicleEvent[]> {
    // Read all events from a Chronicle file
  }

  async tailChronicle(
    path: ChroniclePath,
    n = 50
  ): Promise<ChronicleEvent[]> {
    // Read the last n events from a Chronicle file
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and canonicalization helpers

### Dependents  
- **[@sage/agents](../agents/README.md)** — Agents use Chronicle for recording decisions and reading history
- **[@sage/cli](../../apps/cli/README.md)** — CLI applications use Chronicle for rendering historical context
- **[@sage/valve](../../apps/valve/README.md)** — Valve writes persona triggers to Chronicle files

## Development Status

![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

`@sage/chronicle` is **fully implemented and production-ready** with features that exceed the original specification:

**✅ Core Features:**
- Complete Chronicle API with all contract requirements
- 13 distinct event types with full TypeScript inference
- Industrial-strength file operations with concurrency control
- Sophisticated canonicalization and hashing system

**✅ Advanced Features:**
- Causal chain management and validation
- Chronicle analysis and repair utilities
- Performance optimizations for large-scale operations
- Comprehensive deduplication and optimization systems

**✅ Production Features:**
- Cross-platform file locking with timeout handling
- Atomic operations with crash safety
- Memory-efficient operations for long-running processes
- Comprehensive error handling and recovery

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
```

## Contract

This package implements the **[Chronicle Contract](./CONTRACT.md)**, which defines:
- Append-only API with idempotent behavior
- Strong typing with comprehensive event model
- Concurrency-safe file operations
- Canonicalization and hashing for event integrity

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
