# @sage/[package-name]

> [One-line tagline describing the package's purpose]

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

[2-3 sentences explaining what this package does and why it exists within the SAGE ecosystem]

## Installation

```bash
pnpm add @sage/[package-name]
```

## Quick Start

```typescript
import { [MainExport] } from '@sage/[package-name]';

// Minimal, copy-pasteable example demonstrating primary use case
const example = new [MainExport]();
await example.[primaryMethod]();
```

## Core API

### [PrimaryClass]

[Brief description of main functionality]

```typescript
// Key method signatures with examples
class [PrimaryClass] {
  async [primaryMethod]([param]: [Type]): Promise<[ReturnType]> {
    // Example usage
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/[dep1]](../[dep1]/README.md)** — [Why this package depends on dep1]
- **[@sage/[dep2]](../[dep2]/README.md)** — [Why this package depends on dep2]

### Dependents  
- **[@sage/[dependent1]](../[dependent1]/README.md)** — [How dependent1 uses this package]
- **[@sage/[dependent2]](../[dependent2]/README.md)** — [How dependent2 uses this package]

## Development Status

![Status: [Production Ready|In Development|Prototype]](https://img.shields.io/badge/Status-[Status]-[color])

[Brief description of current stability and planned changes]

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

This package implements the **[[PackageName] Contract](./CONTRACT.md)**, which defines:
- [Key behavioral guarantee 1]
- [Key behavioral guarantee 2] 
- [Key behavioral guarantee 3]

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*