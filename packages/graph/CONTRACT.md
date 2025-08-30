# Graph Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/graph` package.

## Overview

The `@sage/graph` package maintains the **objective structural reality** of a project. It ingests code into a Kùzu database, versions every node/edge by commit, and exposes a commit-addressable query interface. It is the substrate for all **Gnosis**: every Guardian self-inquiry, Delegator validation, and Librarian schema check grounds itself in this graph.

This contract specifies the expected behavior, interfaces, and guarantees that the Graph implementation must provide.

## Core Guarantees

### Ground Truth

- Code Graph is always authoritative versus agent beliefs.
- The graph provides an objective representation of the codebase's structural reality.
- All queries return factual information about the code structure.

### Time-Travel

- Any past state can be reconstructed exactly via git.
- Database snapshots are committed to git for perfect versioning.
- Historical queries can be performed at any commit.

### Auditability

- Every database state ties directly to a git commit hash.
- All changes to the graph are traceable and verifiable.
- Query results include metadata about the commit they were executed against.

### Semantic Richness

- The graph stores files, functions, classes, variables, imports, and dependencies.
- Entities are strongly typed with rich metadata.
- Relationships between entities capture semantic meaning.

## Interface Specifications

### Main API Functions

The core Graph API provides functions for ingesting projects and querying the graph:

```typescript
export interface IngestOptions {
  projectPath: string;
  commitHash?: string;
}

export interface QueryOptions {
  query: string;
  params?: Record<string, any>;
  commit?: string;
}

export interface QueryResult<T = any> {
  results: T[];
  error?: Error;
  meta?: {
    commit?: string;
    executionTimeMs?: number;
    rowCount?: number;
  };
}

/**
 * Ingests a project into the graph database.
 */
export function ingestProject(options: IngestOptions): Promise<void>;

/**
 * Query the graph database with optional commit-specific queries.
 */
export function queryGraph<T = any>(options: QueryOptions): Promise<QueryResult<T>>;

/**
 * Get current database status and metadata.
 */
export function getDatabaseStatus(projectPath?: string): Promise<{
  exists: boolean;
  path: string;
  currentCommit?: string;
  hasUncommittedChanges?: boolean;
}>;

/**
 * Utility to create a database connection for advanced use cases.
 */
export function createDatabaseClient(config?: DatabaseConfig): RustKuzuClient;

/**
 * Utility to create a git manager for advanced git operations.
 */
export function createGitManager(projectPath: string, debug?: boolean): GitDatabaseManager;
```

### Data Model

The Graph uses a rich data model to represent code entities and relationships:

```typescript
// Graph-native types (matching Rust format for zero-conversion)
export interface GraphEntity {
  id: string;
  kind: string;
  name: string;
  text: string;
  filePath: string;
  line: number;
  column_num: number;
  pos: number;
  end: number;
  flags: number;
  parentScopeId?: string; // For scope-based CONTAINS relationships
  extension?: string; // File extension (only for SourceFile entities)
  isModule?: boolean; // Whether file has imports/exports (only for SourceFile entities)
  size?: number; // File size in bytes (only for SourceFile entities)
  entityCount?: number; // Number of entities in file (only for SourceFile entities)
  totalLines?: number; // Total lines in file (only for SourceFile entities)
  relationshipCount?: number; // Number of relationships involving this file (only for SourceFile entities)
  // First-class entity metadata fields
  isAsync?: boolean; // For Function/Method
  isExported?: boolean; // For Function/Class/Interface/Variable/etc
  isAbstract?: boolean; // For Class
  isStatic?: boolean; // For Method/Property
  visibility?: string; // For Method/Property ("public" | "private" | "protected")
  className?: string; // For Method/Property (parent class name)
  returnType?: string; // For Function/Method
  parameters?: string[]; // For Function/Method
  superClass?: string; // For Class
  interfaces?: string[]; // For Class/Interface
  type?: string; // For Variable/Property
  isConst?: boolean; // For Variable/Enum
  isReadonly?: boolean; // For Property
  isOptional?: boolean; // For Property
  scope?: string; // For Variable ("parameter" | "local" | "module" | "block")
  defaultValue?: string; // For Variable/Property
  extends?: string[]; // For Interface
  properties?: string[]; // For Interface
  members?: string[]; // For Enum
  definition?: string; // For TypeAlias
  typeParameters?: string[]; // For TypeAlias
  localName?: string; // For ImportAlias/ExportAlias
  originalName?: string; // For ImportAlias/ExportAlias
  importPath?: string; // For ImportAlias
  exportType?: string; // For ExportAlias ("named" | "default" | "namespace")
  signature?: string; // Original signature text
}

export interface GraphRelationship {
  from: string;
  to: string;
  fromKind: string;
  toKind: string;
  type: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  metadata: Record<string, any>;
}
```

### Schema

The Graph uses a strongly-typed schema to represent code entities:

```cypher
(:File {path, name, size, hash})
(:Function {name, signature, startLine, endLine})
(:Class {name, isAbstract, isExported})
(:Variable {name, type, isConst})

(:File)-[:IMPORTS]->(:File)
(:File)-[:DEFINES_FUNCTION]->(:Function)
(:Class)-[:HAS_METHOD]->(:Function)
(:Function)-[:CALLS]->(:Function)
```

## Error Handling

The Graph implementation provides clear error messages for:

1. **Validation Errors** - Invalid project paths or missing Git repositories
2. **Ingestion Errors** - Issues with parsing code or ingesting into the database
3. **Query Errors** - Invalid Cypher queries or database connection issues
4. **Git Errors** - Issues with Git operations or commit management

All errors follow SAGE's error handling conventions using typed errors from `@sage/utils`.

## Implementation Strategy

### Version 1 (Git-Committed)

The current implementation uses a simplified but robust versioning strategy:

1. **AST Analysis** - The complete TypeScript/JavaScript AST is parsed to extract all code entities and their relationships.
2. **Database Replacement** - For each `ingestProject` call, the existing Kùzu database (`.sage/code.kuzu`) is completely deleted and rebuilt from scratch with the new analysis data.
3. **Git Versioning** - After a successful ingestion, the entire `.sage/code.kuzu` database file is committed to git. This provides perfect, auditable, and reproducible time-travel.
4. **Historical Queries** - To query a past state, the database file from the corresponding git commit is checked out to a temporary location and queried.

### Future Enhancements

1. **Incremental Ingestion** - Diff-aware ingestion with MVCC fields for performance
2. **Advanced Schema** - First-class types and richer metadata
3. **Performance Optimizations** - Streaming and bulk ingestion improvements

## Advanced Features

### Commit-Addressable Storage

- Database snapshots are committed to git for perfect versioning
- Historical queries can be performed at any commit
- All database states are auditable and reproducible

### Query Interface

- Safe, async helpers for Cypher queries at specific commits
- Parameterized queries to prevent injection attacks
- Metadata-rich results with execution timing and row counts

### Git Integration

- Automatic commit detection and management
- Temporary database checkout for historical queries
- Cleanup of temporary files after queries

## Future Extensions

This contract may be extended as Graph evolves to include:

- Additional entity types for other programming languages
- Enhanced relationship discovery algorithms
- Integration with distributed storage systems
- Advanced analytics and reporting features
- Real-time graph updates for development workflows