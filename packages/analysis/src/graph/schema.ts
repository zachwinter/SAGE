import type { GraphEntity, GraphRelationship } from "../types.js";

// Re-export types for convenience
export type { GraphEntity, GraphRelationship };

/**
 * All relationship types in our Kuzu database schema
 * These match exactly what's created by the Rust ingestion pipeline
 * Based on actual database inspection after fresh ingestion
 */
export const RELATIONSHIP_TYPES = [
  // The Big 5 - Core relationships with high frequency
  "REFERENCES",         // Property access, variable usage  
  "CALLS",              // Function/method calls (✓ 311 in DB)
  "DECLARES",           // Variable/function declarations
  "TYPE_OF",            // Type references, generics
  "DEFINES",            // Variable assignments, initializers
  
  // Control Flow & Structure  
  "RETURNS",            // Return statements
  "AWAITS",             // Async operations
  "IMPORTS",            // Local imports
  "EXPORTS",            // Export statements (✓ 253 in DB)
  
  // Type System
  "CASTS_TO",           // Type assertions
  "UNION_WITH",         // Union types
  "EXTENDS",            // Inheritance
  "IMPLEMENTS",         // Interface implementation
  "INTERSECTS_WITH",    // Intersection types
  
  // Language Features
  "DESTRUCTURES",       // Destructuring patterns
  "DECORATES",          // Decorators
  "SPREADS",            // Spread syntax
  "CATCHES",            // Error handling
  "THROWS",             // Exception throwing
  "BRANCHES_ON",        // Conditional expressions
  
  // File organization
  "CONTAINS",           // Lexical containment (✓ 920 in DB)
  "BELONGS_TO",         // Entity belongs to module
  "IMPORTS_EXTERNAL",   // External module imports (✓ 442 in DB)
  
  // Project hierarchy
  "HAS_APPLICATION",    // Project -> Application (✓ 3 in DB)
  "HAS_PACKAGE",        // Project -> Package (✓ 3 in DB)
  "HAS_ENTRYPOINT",     // Application -> SourceFile
  
  // Dependencies
  "DEPENDS_ON",         // Package -> Dependency
  "USES_DEPENDENCY",    // CodeEntity -> Dependency  
  "IMPORTS_FROM",       // Import -> Dependency
] as const;

/**
 * All node types in our Kuzu database schema
 * These match exactly what's created by the Rust ingestion pipeline
 * Based on actual database inspection after fresh ingestion
 */
export const NODE_TYPES = [
  // Core code entity types (stored in CodeEntity table)
  "function",
  "class", 
  "interface",
  "type",
  "import",
  "export", 
  "variable",
  "struct",
  "enum",
  "trait",
  "implementation",
  "module",
  "constant",
  "static",
  "type-alias",
  
  // Dedicated node table types (✓ confirmed in DB)
  "Application",        // Applications table
  "CodeEntity",         // Main code entities table  
  "Dependency",         // Dependencies table
  "ExternalModule",     // External modules table
  "Module",             // Modules table
  "Package",            // Packages table
  "Project",            // Project table
  "SourceFile",         // Source files table
] as const;

/**
 * Complete Kuzu schema DDL commands
 * Matches exactly what's created by the Rust ingestion pipeline
 * Based on actual database inspection after fresh ingestion
 */
export const KUZU_SCHEMA_COMMANDS = [
  // Core node table for all code entities
  `CREATE NODE TABLE CodeEntity(
    id STRING,
    kind STRING,
    name STRING,
    text STRING,
    filePath STRING,
    lineNum INT64,
    colNum INT64,
    startPos INT64,
    endPos INT64,
    nodeFlags INT64,
    PRIMARY KEY(id)
  );`,

  // File nodes for organizing entities
  `CREATE NODE TABLE SourceFile(
    path STRING,
    extension STRING,
    size INT64,
    totalLines INT64,
    entityCount INT64,
    relationshipCount INT64,
    PRIMARY KEY(path)
  );`,

  // Module/Package organization
  `CREATE NODE TABLE Module(
    name STRING,
    path STRING,
    isExternal BOOLEAN,
    PRIMARY KEY(name)
  );`,

  // Project root entity
  `CREATE NODE TABLE Project(
    id STRING,
    name STRING,
    path STRING,
    version STRING,
    packageManager STRING,
    totalFiles INT64,
    totalEntities INT64,
    totalPackages INT64,
    totalApplications INT64,
    PRIMARY KEY(id)
  );`,

  // Application entities
  `CREATE NODE TABLE Application(
    id STRING,
    name STRING,
    path STRING,
    version STRING,
    main STRING,
    types STRING,
    applicationType STRING,
    entryPointCount INT64,
    PRIMARY KEY(id)
  );`,

  // Package entities  
  `CREATE NODE TABLE Package(
    id STRING,
    name STRING,
    path STRING,
    version STRING,
    packageType STRING,
    main STRING,
    types STRING,
    PRIMARY KEY(id)
  );`,

  // Dependency entities
  `CREATE NODE TABLE Dependency(
    id STRING,
    name STRING,
    version STRING,
    dependencyType STRING,
    isWorkspaceDependency BOOLEAN,
    description STRING,
    homepage STRING,
    PRIMARY KEY(id)
  );`,

  // External modules (for external imports)
  `CREATE NODE TABLE ExternalModule(
    id STRING,
    name STRING,
    PRIMARY KEY(id)
  );`,

  // The Big 5 Relationship Tables
  `CREATE REL TABLE REFERENCES(FROM CodeEntity TO CodeEntity, 
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE CALLS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isAsync BOOLEAN, metadata STRING);`,

  `CREATE REL TABLE DECLARES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, scope STRING, metadata STRING);`,

  `CREATE REL TABLE TYPE_OF(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isGeneric BOOLEAN, metadata STRING);`,

  `CREATE REL TABLE DEFINES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isInitializer BOOLEAN, metadata STRING);`,

  // Control Flow & Structure
  `CREATE REL TABLE RETURNS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE AWAITS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE IMPORTS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE IMPORTS_EXTERNAL(FROM CodeEntity TO ExternalModule,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE EXPORTS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, exportType STRING, metadata STRING);`,

  // Type System
  `CREATE REL TABLE CASTS_TO(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE UNION_WITH(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE EXTENDS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE IMPLEMENTS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE INTERSECTS_WITH(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  // Language Features
  `CREATE REL TABLE DESTRUCTURES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE DECORATES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE SPREADS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE CATCHES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE THROWS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE BRANCHES_ON(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  // File organization relationships
  `CREATE REL TABLE CONTAINS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE BELONGS_TO(FROM CodeEntity TO Module);`,

  // Project hierarchy relationships
  `CREATE REL TABLE HAS_APPLICATION(FROM Project TO Application,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE HAS_PACKAGE(FROM Project TO Package,
    evidence STRING, confidence STRING, metadata STRING);`,

  `CREATE REL TABLE HAS_ENTRYPOINT(FROM Application TO SourceFile,
    evidence STRING, confidence STRING, metadata STRING);`,

  // Dependency relationships
  `CREATE REL TABLE DEPENDS_ON(FROM Package TO Dependency,
    evidence STRING, confidence STRING, dependencyType STRING, metadata STRING);`,

  `CREATE REL TABLE USES_DEPENDENCY(FROM CodeEntity TO Dependency,
    evidence STRING, confidence STRING, importType STRING, metadata STRING);`,

  `CREATE REL TABLE IMPORTS_FROM(FROM CodeEntity TO Dependency,
    evidence STRING, confidence STRING, metadata STRING);`,
] as const;

// Freeze the arrays to make them readonly at runtime
Object.freeze(RELATIONSHIP_TYPES);
Object.freeze(NODE_TYPES);
Object.freeze(KUZU_SCHEMA_COMMANDS);

/**
 * Type-safe relationship type
 */
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];

/**
 * Type-safe node type
 */
export type NodeType = typeof NODE_TYPES[number];