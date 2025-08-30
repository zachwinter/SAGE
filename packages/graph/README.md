# @sage/graph

> "The Ground Truth."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

This package maintains the **objective structural reality** of a project. It ingests code into a Kùzu database, versions every node/edge by commit, and exposes a commit-addressable query interface. It is the substrate for all **Gnosis**: every Guardian self-inquiry, Delegator validation, and Librarian schema check grounds itself in this graph.

The package provides a **semantically rich, time-traveling Code Graph** that stores files, functions, classes, variables, imports, and dependencies, versions database snapshots via git commits, supports Cypher queries at any point in history, and enables end-to-end traceability of structure, lineage, and evolution.

## Installation

```bash
pnpm add @sage/graph
```

## Quick Start

```typescript
import { ingestProject, queryGraph } from '@sage/graph';

// Minimal, copy-pasteable example demonstrating primary use case
await ingestProject({
  projectPath: "/my/project",
  commitHash: "abc123"
});

const { results } = await queryGraph({
  query: `
    MATCH (f:File {name: "UserService.ts"})-[:IMPORTS]->(dep)
    RETURN dep.name;
  `,
  commit: "abc123" // Query at specific commit
});

console.log("Dependencies:", results);
```

## Core API

### Graph API Functions

The main functions for interacting with the Graph database:

```typescript
// Key method signatures with examples
class GraphAPI {
  /**
   * Ingests a project into the graph database.
   */
  async ingestProject(options: IngestOptions): Promise<void> {
    // Ingest a project into the graph database
  }

  /**
   * Query the graph database with optional commit-specific queries.
   */
  async queryGraph<T = any>(options: QueryOptions): Promise<QueryResult<T>> {
    // Query the graph database
  }

  /**
   * Get current database status and metadata.
   */
  async getDatabaseStatus(projectPath?: string): Promise<{
    exists: boolean;
    path: string;
    currentCommit?: string;
    hasUncommittedChanges?: boolean;
  }> {
    // Get database status
  }

  /**
   * Utility to create a database connection for advanced use cases.
   */
  createDatabaseClient(config?: DatabaseConfig): RustKuzuClient {
    // Create a database client
  }

  /**
   * Utility to create a git manager for advanced git operations.
   */
  createGitManager(projectPath: string, debug?: boolean): GitDatabaseManager {
    // Create a git manager
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and utilities

### Dependents  
- **[@sage/agents](../agents/README.md)** — Agents use Graph for Gnosis & Self-Inquiry
- **[@sage/tools](../tools/README.md)** — Tools use GraphQuery for code analysis
- **[CLI applications](../../apps/cli/README.md)** — CLI uses Graph for the ingest command

## Development Status

![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

The Graph package is production-ready with a robust implementation that leverages Kùzu database technology and git-based versioning. It provides a solid foundation for all code analysis and querying needs within the SAGE ecosystem.

Key features:
- Complete TypeScript AST analysis with 30+ relationship types
- Kùzu database integration with proven schema
- Git-based versioning for time-travel queries
- Comprehensive API for ingestion and querying

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

This package implements the **[Graph Contract](./CONTRACT.md)**, which defines:
- Commit-addressable graph database with time-travel capabilities
- Strongly-typed schema for code entities and relationships
- Safe, async helpers for Cypher queries at specific commits
- Ground truth guarantees for code structure and evolution

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*
