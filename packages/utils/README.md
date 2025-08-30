# @sage/utils

> "Minimal shared types and helpers used across packages. Zero runtime deps."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

This package provides the foundational utilities that all other SAGE packages depend on. It includes shared types, error handling, canonicalization helpers, and time/random abstractions needed for deterministic testing.

The package provides a **minimal, dependency-free foundation** that defines shared types like `ISO8601`, `Clock`, `Random`, provides typed error creation with `TypedError` and `err()` helper, ensures canonical JSON serialization for hashing consistency, and offers cryptographic primitives like `sha256()`.

## Installation

```bash
pnpm add @sage/utils
```

## Quick Start

```typescript
import { err, canonicalJSONStringify, sha256, Logger } from '@sage/utils';

// Minimal, copy-pasteable example demonstrating primary use case
// Create typed errors
const validationError = err("EVALIDATION", "Invalid input", { field: "name" });

// Canonical JSON for consistent hashing
const canonical = canonicalJSONStringify({ c: 3, a: 1, b: 2 });
// → '{"a":1,"b":2,"c":3}'

// Hash content
const hash = await sha256(canonical);

// Use the logger
const logger = new Logger("MyService");
logger.info("Hello, world!");
```

## Core API

### Core Types and Interfaces

The main types and interfaces provided by the package:

```typescript
// Key method signatures with examples
export type ISO8601 = string & { __brand: 'ISO8601' };

export interface Clock {
  now(): ISO8601;
}

export interface Random {
  int(): number;
  float(): number;
}

export interface TypedError extends Error {
  code: string;
  cause?: unknown;
}

/**
 * An interface for a provider that can resolve secret values from a secure backend.
 * This is the core of the Vault-Warden Protocol.
 */
export interface SecretProvider {
  /**
   * Fetches a secret value by its key.
   * @param key The identifier of the secret (e.g., "GITHUB_API_KEY").
   * @returns The secret value, or undefined if not found.
   */
  get(key: string): Promise<string | undefined>;
}
```

### Error Handling

Utilities for typed error creation and handling:

```typescript
export class ErrorCodes {
  static readonly VALIDATION = "EVALIDATION";
  static readonly IO = "EIO";
  static readonly NETWORK = "ENETWORK";
  // ... other error codes
}

export function err(
  code: string,
  message: string,
  meta?: Record<string, any>
): TypedError;

export function isTypedError(error: unknown): error is TypedError;

export function isErrorCode(error: TypedError, code: string): boolean;

export function serializeError(error: Error): string;

export function formatErrorMessage(error: TypedError): string;
```

### Canonicalization and Crypto

Utilities for canonical JSON serialization and cryptographic operations:

```typescript
export function canonicalJSONStringify(obj: any): string;

export function sha256(content: string): Promise<string>;
```

### Clock and Random

Deterministic time and random number generation:

```typescript
export class SystemClock implements Clock {
  now(): ISO8601;
}

export class FixedClock implements Clock {
  now(): ISO8601;
}

export class SystemRandom implements Random {
  int(): number;
  float(): number;
}

export class SeededRandom implements Random {
  int(): number;
  float(): number;
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **None** — This is the foundational package with no dependencies

### Dependents  
- **All SAGE packages** — Every other package depends on @sage/utils for shared types, error handling, and deterministic operations
- **Package developers** — Anyone building on SAGE uses these foundational utilities

## Development Status

![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

The utils package is production-ready and forms the foundation for all other SAGE packages. It provides essential utilities with zero runtime dependencies.

**✅ Core Features Implemented:**
- Core types and interfaces (ISO8601, Clock, Random, TypedError)
- Error handling with typed errors and error codes
- Canonicalization helpers for consistent JSON serialization
- Cryptographic primitives (sha256)
- Deterministic time and random number generation
- Logging utilities

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in development mode
pnpm dev
```

## Contract

This package implements the **[Utils Contract](./CONTRACT.md)**, which defines:
- Minimal, dependency-free foundation for all SAGE packages
- Shared types, error handling, and deterministic utilities
- Canonical JSON serialization for hashing consistency
- Cryptographic primitives for secure operations

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
