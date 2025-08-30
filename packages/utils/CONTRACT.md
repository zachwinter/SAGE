# Utils Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/utils` package.

## Overview

This package provides the foundational utilities that all other SAGE packages depend on. It includes shared types, error handling, canonicalization helpers, and time/random abstractions needed for deterministic testing.

This contract specifies the expected behavior, interfaces, and guarantees that the utils implementation must provide.

## Core Guarantees

### Minimal Dependencies

- Zero runtime dependencies outside of the standard library
- No I/O operations unless explicitly needed
- No framework assumptions or tight coupling
- Pure utility functions with no side effects

### Deterministic Operations

- Time abstractions with predictable behavior
- Seeded random number generation for reproducible results
- Consistent hashing and canonicalization
- Stable type definitions across versions

### Type Safety

- Strongly typed interfaces and utilities
- Compile-time error detection
- Runtime validation where needed
- Clear error taxonomy and handling

### Performance

- Optimized utility functions
- Minimal memory footprint
- Efficient serialization and hashing
- Fast error creation and handling

## Interface Specifications

### Core Types

```typescript
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

```typescript
export class ErrorCodes {
  static readonly VALIDATION = "EVALIDATION";
  static readonly IO = "EIO";
  static readonly NETWORK = "ENETWORK";
  static readonly PARSE = "EPARSE";
  static readonly TIMEOUT = "ETIMEOUT";
  static readonly PERMISSION = "EPERMISSION";
  static readonly NOT_FOUND = "ENOTFOUND";
  static readonly CONFLICT = "ECONFLICT";
  static readonly UNAVAILABLE = "EUNAVAILABLE";
  static readonly UNSUPPORTED = "EUNSUPPORTED";
  static readonly INVALID_STATE = "EINVALIDSTATE";
  static readonly QUOTA = "EQUOTA";
  static readonly RATE_LIMIT = "ERATELIMIT";
  static readonly SECURITY = "ESECURITY";
  static readonly CONFIG = "ECONFIG";
  static readonly DEPRECATED = "EDEPRECATED";
  static readonly INTERNAL = "EINTERNAL";
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

```typescript
export function canonicalJSONStringify(obj: any): string;

export function sha256(content: string): Promise<string>;
```

### Clock and Random

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

### Logging

```typescript
export class Logger {
  constructor(serviceName?: string, logFileName?: string);
  
  info(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
  debug(message: string, ...meta: any[]): void;
  
  clearLogFile(): void;
}
```

## Core Types and Interfaces

### ISO8601

A branded string type for ISO 8601 formatted timestamps:

- Ensures type safety for timestamp values
- Prevents accidental string concatenation with non-timestamps
- Provides consistent timestamp format across the ecosystem

### Clock

An interface for time abstraction:

- `now()`: Returns the current time as an ISO8601 string
- Enables deterministic testing with FixedClock
- Supports system time with SystemClock

### Random

An interface for random number generation:

- `int()`: Returns a random integer
- `float()`: Returns a random float between 0 and 1
- Enables deterministic testing with SeededRandom
- Supports system randomness with SystemRandom

### TypedError

An interface for typed errors:

- Extends the standard Error interface
- Includes a code property for error categorization
- Optional cause property for error chaining
- Enables structured error handling across packages

### SecretProvider

An interface for secret resolution:

- Core of the Vault-Warden Protocol
- Enables just-in-time secret injection
- Supports secure secret management
- Prevents secret leakage in logs and storage

## Error Handling

### Error Codes

A comprehensive taxonomy of error codes:

- `EVALIDATION`: Input validation errors
- `EIO`: Input/output errors
- `ENETWORK`: Network-related errors
- `EPARSE`: Parsing errors
- `ETIMEOUT`: Timeout errors
- `EPERMISSION`: Permission denied errors
- `ENOTFOUND`: Resource not found errors
- `ECONFLICT`: Resource conflict errors
- `EUNAVAILABLE`: Service unavailable errors
- `EUNSUPPORTED`: Unsupported operation errors
- `EINVALIDSTATE`: Invalid state errors
- `EQUOTA`: Quota exceeded errors
- `ERATELIMIT`: Rate limit exceeded errors
- `ESECURITY`: Security-related errors
- `ECONFIG`: Configuration errors
- `EDEPRECATED`: Use of deprecated features
- `EINTERNAL`: Internal errors

### Error Creation

Utilities for creating typed errors:

- `err()`: Creates a new TypedError with code, message, and metadata
- Consistent error structure across the ecosystem
- Support for error metadata and context
- Proper stack trace preservation

### Error Checking

Utilities for checking error types:

- `isTypedError()`: Type guard for TypedError instances
- `isErrorCode()`: Checks if an error has a specific code
- Enables safe error handling in TypeScript
- Supports error pattern matching

### Error Serialization

Utilities for serializing errors:

- `serializeError()`: Converts an error to a string representation
- `formatErrorMessage()`: Formats an error message for display
- Preserves error metadata and context
- Supports cross-process error communication

## Canonicalization and Crypto

### Canonical JSON

Utilities for canonical JSON serialization:

- `canonicalJSONStringify()`: Serializes objects to canonical JSON
- Ensures consistent key ordering
- Removes whitespace and formatting
- Supports deterministic hashing

### SHA-256

Cryptographic hashing utilities:

- `sha256()`: Computes SHA-256 hash of content
- Returns hexadecimal string representation
- Supports async operations
- Uses platform-native crypto when available

## Clock and Random

### System Implementations

Platform-native implementations:

- `SystemClock`: Uses system time for real-world applications
- `SystemRandom`: Uses system randomness for real-world applications
- Provides high-quality entropy sources
- Supports production environments

### Deterministic Implementations

Controlled implementations for testing:

- `FixedClock`: Returns a fixed time for deterministic testing
- `SeededRandom`: Uses a seed for reproducible random sequences
- Enables consistent test results
- Supports debugging and reproduction

## Advanced Features

### Directory Management

Utilities for directory operations:

- Cross-platform path handling
- Directory creation and cleanup
- Temporary directory management
- Secure file operations

### TTY Utilities

Terminal detection and handling:

- `checkTTY()`: Determines if running in a TTY environment
- Enables adaptive UI behavior
- Supports both terminal and non-terminal environments
- Facilitates testing and automation

### Progress Tracking

Utilities for progress indication:

- Progress tracking with percentage completion
- ETA calculation and display
- Supports both terminal and non-terminal environments
- Configurable update intervals

### Pretty Task Execution

Utilities for task execution with formatting:

- Formatted task execution with status updates
- Success and failure handling
- Supports both synchronous and asynchronous tasks
- Configurable output formatting

## Testing Support

### Deterministic Testing

Support for reproducible tests:

- Fixed time sources for consistent timestamps
- Seeded random number generation
- Mock implementations for external dependencies
- Isolated test environments

### Error Testing

Support for error condition testing:

- Comprehensive error taxonomy
- Easy error creation for test scenarios
- Error pattern matching utilities
- Mock error injection capabilities

## Future Extensions

This contract may be extended as utils evolves to include:

- Additional utility functions for common operations
- Enhanced error handling and reporting features
- Advanced cryptographic primitives
- Internationalization and localization utilities
- Performance monitoring and profiling tools
- Advanced logging and tracing capabilities
- Enhanced security utilities
- Integration with external utility libraries