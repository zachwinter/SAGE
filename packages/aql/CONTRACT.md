# AQL Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/aql` package.

## Overview

AQL (Agent/Action Query Language) is a declarative language for orchestrating agent workflows and tool executions. This contract specifies the expected behavior, interfaces, and guarantees that the AQL implementation must provide.

## Core Guarantees

### Strong Typing and Validation

- All AQL queries must be strongly typed with parameters and operation inputs/outputs having defined types
- The parser must validate type correctness at parse time
- Runtime validation must occur for all operation inputs against their declared types

### Deterministic Planning

- For any given AQL query and input variables, the execution plan must be deterministic
- Dependency resolution must be consistent and predictable
- Parallel execution must not introduce non-determinism in results

### Framework Agnosticism

- The AQL engine must be able to execute queries against different agent execution backends
- The core engine must not have hard dependencies on specific LLM providers or tool implementations
- Extension points must be provided for integrating with various agent and tool systems

### Auditability

- All execution steps must be traceable and loggable
- Execution results must include metadata about timing, tokens used, and errors
- The execution engine must support debug mode for detailed tracing

## Interface Specifications

### AQL Class

The main entry point for using AQL in code:

```typescript
class AQL {
  async initialize(): Promise<void>;
  parseQuery(aqlSource: string): AQLQuery;
  async executeQuery(query: AQLQuery, variables?: Record<string, any>): Promise<ExecutionResult>;
  async run(aqlSource: string, variables?: Record<string, any>): Promise<ExecutionResult>;
  setDebug(debug: boolean): void;
  setTimeout(timeout: number): void;
  setRetries(retries: number): void;
}
```

### AQLQuery

The parsed representation of an AQL query:

```typescript
interface AQLQuery {
  name: string;
  parameters: Parameter[];
  operations: Operation[];
}
```

### ExecutionResult

The result of executing an AQL query:

```typescript
interface ExecutionResult {
  query: string;
  results: Record<string, any>;
  metadata: {
    totalTime: number;
    totalTokens: number;
    operationsExecuted: number;
    errors: ExecutionError[];
  };
}
```

## Error Handling

The AQL implementation must provide clear error messages for:

1. **Parse Errors** - Invalid syntax in AQL source
2. **Validation Errors** - Type mismatches or missing required parameters
3. **Execution Errors** - Failures during operation execution
4. **Timeout Errors** - Operations exceeding configured timeouts

All errors must include sufficient context to help developers diagnose and fix issues.

## Future Extensions

This contract will be extended as AQL evolves to include:

- Tool operation support
- Integration with @sage/chronicle for event logging
- Full SAGE ecosystem integration
- Advanced features like conditional execution and loops