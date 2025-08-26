# Graph Database Schema Design

## Overview

This document outlines the proposed evolution from our current "tagged union" approach (`CodeEntity` with `kind` field) to first-class vertex types for each code construct.

### Key Design Principle: SourceFile as Dual-Role Entity

A crucial insight: **SourceFile and Module are the same entity**. A SourceFile serves dual roles:
1. **Storage role**: Container of code on disk (file system perspective)
2. **Execution role**: Module that imports, exports, and executes code (runtime perspective)

This means SourceFile can:
- **CONTAIN** functions, classes, variables (as a file)
- **CALL** functions and methods (as executing module scope)
- **REFERENCE** variables (as executing module scope)  
- **IMPORT** from other modules
- **EXPORT** its contained entities

No artificial separation needed - it's one entity playing contextual roles!

## Current State

```sql
-- Single table with discriminator field
CREATE NODE TABLE CodeEntity(
  id STRING,
  kind STRING,  -- "function" | "class" | "variable" | etc.
  name STRING,
  text STRING,
  filePath STRING,
  lineNum INT64,
  colNum INT64,
  startPos INT64,
  endPos INT64,
  nodeFlags INT64,
  PRIMARY KEY(id)
);

-- Generic relationships
CREATE REL TABLE CALLS(FROM CodeEntity TO CodeEntity, ...);
CREATE REL TABLE CONTAINS(FROM CodeEntity TO CodeEntity, ...);
```

## Proposed First-Class Vertices

### Code Entity Node Tables

```sql
-- Functions (top-level functions)
CREATE NODE TABLE Function(
  id STRING,
  name STRING,
  isAsync BOOLEAN,
  isExported BOOLEAN,
  returnType STRING,
  parameters STRING[], -- JSON array of parameter info
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Classes  
CREATE NODE TABLE Class(
  id STRING,
  name STRING,
  isAbstract BOOLEAN,
  isExported BOOLEAN,
  superClass STRING,
  interfaces STRING[], -- interfaces this class implements
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Methods (class behavior - functions within classes)
CREATE NODE TABLE Method(
  id STRING,
  name STRING,
  isAsync BOOLEAN,
  isStatic BOOLEAN,
  visibility STRING, -- "public" | "private" | "protected"
  returnType STRING,
  parameters STRING[],
  className STRING, -- reference to containing class
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Properties (class state - data members within classes)  
CREATE NODE TABLE Property(
  id STRING,
  name STRING,
  type STRING,
  isStatic BOOLEAN,
  visibility STRING, -- "public" | "private" | "protected"
  isReadonly BOOLEAN,
  isOptional BOOLEAN,
  defaultValue STRING,
  className STRING, -- reference to containing class
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Variables (scoped data - parameters, locals, module-level)
CREATE NODE TABLE Variable(
  id STRING,
  name STRING,
  type STRING,
  isConst BOOLEAN,
  isExported BOOLEAN,
  scope STRING, -- "parameter" | "local" | "module" | "block"
  defaultValue STRING,
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Interfaces
CREATE NODE TABLE Interface(
  id STRING,
  name STRING,
  isExported BOOLEAN,
  extends STRING[], -- interfaces this extends
  properties STRING[], -- JSON array of property info
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Enums
CREATE NODE TABLE Enum(
  id STRING,
  name STRING,
  isConst BOOLEAN,
  isExported BOOLEAN,
  members STRING[], -- enum member values
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Type Aliases
CREATE NODE TABLE TypeAlias(
  id STRING,
  name STRING,
  isExported BOOLEAN,
  definition STRING, -- the actual type definition
  typeParameters STRING[], -- generic type parameters
  filePath STRING,
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,
  PRIMARY KEY(id)
);

-- Import Aliases (compile-time name bindings)
CREATE NODE TABLE ImportAlias(
  id STRING,
  localName STRING,    -- what it's called in this file
  originalName STRING, -- what it's called in source file  
  importPath STRING,   -- "./utils.js" or "lodash"
  filePath STRING,     -- which file contains this import
  line INT64,
  column INT64,
  startPos INT64,
  endPos INT64,
  signature STRING,    -- the import statement text
  PRIMARY KEY(id)
);
```

### Container/Organizer Node Tables

```sql
-- SourceFile (also serves as module execution context)
CREATE NODE TABLE SourceFile(
  path STRING,
  extension STRING,
  isModule BOOLEAN, -- true if has exports/imports
  size INT64,
  totalLines INT64,
  entityCount INT64,
  relationshipCount INT64,
  PRIMARY KEY(path)
);

-- Keep existing organizational tables
CREATE NODE TABLE Project(...);
CREATE NODE TABLE Application(...);
CREATE NODE TABLE Package(...);
CREATE NODE TABLE Dependency(...);
CREATE NODE TABLE ExternalModule(...);
```

## Relationship Tables

### Core Code Relationships (Using Kuzu's Polymorphic Relationship Support!)

**🎉 Kuzu supports multiple FROM/TO pairs in a single relationship table!**  
Each relationship table below internally creates separate tables for each combination, but can be queried as a unified relationship.

```sql
-- Polymorphic CALLS relationship (all call combinations)
CREATE REL TABLE CALLS(
  FROM Function TO Function,      -- function calls function
  FROM Method TO Function,        -- method calls function  
  FROM Method TO Method,          -- method calls method
  FROM Function TO Method,        -- function calls method
  FROM SourceFile TO Function,    -- module-level call to function
  FROM SourceFile TO Method,      -- module-level call to method
  evidence STRING, 
  confidence STRING, 
  isAsync BOOLEAN, 
  metadata STRING
);

-- Polymorphic REFERENCES relationship (all reference combinations)
CREATE REL TABLE REFERENCES(
  FROM Function TO Variable,      -- function references variable
  FROM Method TO Variable,        -- method references variable  
  FROM Method TO Property,        -- method references class property
  FROM SourceFile TO Variable,    -- module references variable
  FROM SourceFile TO Property,    -- module references class property (static access)
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);
```

**Query Benefits:**
```cypher
-- Single query finds ALL calls regardless of caller type!
MATCH (caller)-[:CALLS]->(target:Function {name: "processUser"})
RETURN caller, labels(caller)

-- No need for UNION queries - Kuzu handles the polymorphism internally
MATCH (anything)-[:REFERENCES]->(v:Variable {name: "API_KEY"})  
RETURN anything.name, labels(anything)
```

### Containment Relationships (Hierarchical - Direct Children Only!)

**Key Principle**: Each container only CONTAINS its direct children. To find deeply nested entities, walk the graph with `[:CONTAINS*]`.

```sql
-- File-level containment (TOP-LEVEL ENTITIES ONLY)
CREATE REL TABLE CONTAINS(
  FROM SourceFile TO Function,  -- top-level functions only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO Class,     -- top-level classes only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO Interface, -- top-level interfaces only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO Variable,  -- module-scoped variables only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO Enum,      -- top-level enums only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO TypeAlias, -- top-level type aliases only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM SourceFile TO ImportAlias, -- import statements in file
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

-- Class containment (CLASS MEMBERS ONLY)
CREATE REL TABLE CONTAINS(
  FROM Class TO Method,         -- class methods only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM Class TO Property,       -- class properties only (not variables!)
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

-- Function/method local scope containment (LOCAL VARIABLES ONLY)  
CREATE REL TABLE CONTAINS(
  FROM Function TO Variable,    -- function's local variables only
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE CONTAINS(
  FROM Method TO Variable,      -- method's local variables only  
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);
```

**Containment Hierarchy Examples:**
```
app.ts (SourceFile)
├── processUser (Function)           ← SourceFile CONTAINS Function
│   ├── userData (Variable)          ← Function CONTAINS Variable (local)
│   └── temp (Variable)              ← Function CONTAINS Variable (local)
├── UserService (Class)              ← SourceFile CONTAINS Class
│   ├── users (Property)             ← Class CONTAINS Property (class state)
│   └── getUser (Method)             ← Class CONTAINS Method
│       ├── id (Variable)            ← Method CONTAINS Variable (parameter)
│       └── result (Variable)        ← Method CONTAINS Variable (local)
└── API_KEY (Variable)               ← SourceFile CONTAINS Variable (module-scoped)
```

**Query Patterns:**
```cypher
-- Direct children only
MATCH (file:SourceFile {path: "app.ts"})-[:CONTAINS]->(child)
RETURN child.name, labels(child)

-- All descendants at any depth  
MATCH (file:SourceFile {path: "app.ts"})-[:CONTAINS*]->(descendant)
RETURN descendant.name, labels(descendant)

-- Show containment hierarchy with depth
MATCH path = (file:SourceFile {path: "app.ts"})-[:CONTAINS*]->(entity)
RETURN entity.name, length(path) as depth, 
       [node in nodes(path)[1..] | node.name] as containment_path
```

### Export/Import Relationships

```sql
-- What does a file export?
CREATE REL TABLE EXPORTS(
  FROM SourceFile TO Function,
  evidence STRING, 
  confidence STRING, 
  exportType STRING, -- "named" | "default" | "namespace"
  metadata STRING
);

CREATE REL TABLE EXPORTS(
  FROM SourceFile TO Class,
  evidence STRING, 
  confidence STRING, 
  exportType STRING,
  metadata STRING
);

CREATE REL TABLE EXPORTS(
  FROM SourceFile TO Interface,
  evidence STRING, 
  confidence STRING, 
  exportType STRING,
  metadata STRING
);

-- ... (similar for other exportable types)

-- External imports
CREATE REL TABLE IMPORTS(
  FROM SourceFile TO ExternalModule,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);
```

### Type System Relationships

```sql
-- Inheritance
CREATE REL TABLE EXTENDS(
  FROM Class TO Class,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE EXTENDS(
  FROM Interface TO Interface,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

-- Implementation
CREATE REL TABLE IMPLEMENTS(
  FROM Class TO Interface,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

-- Type usage
CREATE REL TABLE TYPE_OF(
  FROM Variable TO TypeAlias,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);

CREATE REL TABLE TYPE_OF(
  FROM Variable TO Interface,
  evidence STRING, 
  confidence STRING, 
  metadata STRING
);
```

### Import Resolution & Instance Relationships

```sql
-- Import alias resolution (compile-time name bindings)
CREATE REL TABLE RESOLVES_TO(
  FROM ImportAlias TO Function,    -- import { processData } resolves to Function
  FROM ImportAlias TO Class,       -- import { User } resolves to Class  
  FROM ImportAlias TO Interface,   -- import { IUser } resolves to Interface
  FROM ImportAlias TO Variable,    -- import { API_KEY } resolves to Variable
  FROM ImportAlias TO TypeAlias,   -- import { CustomType } resolves to TypeAlias
  evidence STRING,
  confidence STRING,
  metadata STRING
);

-- Class instantiation (runtime object creation)
CREATE REL TABLE INSTANCE_OF(
  FROM Variable TO Class,          -- const user = new User()
  FROM Property TO Class,          -- this.processor = new DataProcessor()
  evidence STRING, 
  confidence STRING,
  metadata STRING
);

-- Usage through import aliases
CREATE REL TABLE CALLS(
  FROM SourceFile TO ImportAlias,  -- module calls imported function/method via alias
  FROM Function TO ImportAlias,    -- function calls imported entity via alias
  FROM Method TO ImportAlias,      -- method calls imported entity via alias
  evidence STRING,
  confidence STRING, 
  isAsync BOOLEAN,
  metadata STRING
);

CREATE REL TABLE REFERENCES(
  FROM SourceFile TO ImportAlias,  -- module references imported entity via alias
  FROM Function TO ImportAlias,    -- function references imported entity via alias  
  FROM Method TO ImportAlias,      -- method references imported entity via alias
  evidence STRING,
  confidence STRING,
  metadata STRING
);
```

## Sample Queries

### Basic Queries

```cypher
-- What does this file export?
MATCH (f:SourceFile {path: "utils.ts"})-[:EXPORTS]->(exported)
RETURN exported;

-- Find all async functions
MATCH (f:Function {isAsync: true})
RETURN f.name, f.filePath;

-- What methods does this class have?
MATCH (c:Class {name: "UserService"})-[:CONTAINS]->(m:Method)
RETURN m.name, m.signature;
```

### Complex Analysis Queries

```cypher
-- Find functions that call other functions (call graph)
MATCH (caller:Function)-[:CALLS]->(callee:Function)
RETURN caller.name, callee.name, caller.filePath, callee.filePath;

-- Class dependency graph
MATCH (c1:Class)-[:CONTAINS]->(m:Method)-[:CALLS]->(target)
MATCH (c2:Class)-[:CONTAINS]->(target)
WHERE c1 <> c2
RETURN c1.name AS from_class, c2.name AS to_class;

-- Find unused exports
MATCH (f:SourceFile)-[:EXPORTS]->(exported)
WHERE NOT EXISTS {
  MATCH ()-[:CALLS|REFERENCES]->(exported)
}
RETURN f.path, exported.name;
```

### Import & Instance Analysis Queries 🔥

```cypher  
-- What does this file import and how does it use each import?
MATCH (file:SourceFile {path: "app.ts"})-[:CONTAINS]->(alias:ImportAlias)
MATCH (alias)-[:RESOLVES_TO]->(original)
OPTIONAL MATCH (caller)-[:CALLS]->(alias)
OPTIONAL MATCH (referencer)-[:REFERENCES]->(alias)
RETURN alias.localName, alias.originalName, alias.importPath, 
       labels(original) as originalType, 
       count(caller) as callCount,
       count(referencer) as referenceCount;

-- Find all imported classes and their local instances  
MATCH (alias:ImportAlias)-[:RESOLVES_TO]->(UserClass:Class)
MATCH (instance:Variable)-[:INSTANCE_OF]->(UserClass)
RETURN UserClass.name, alias.localName, alias.filePath as importedIn,
       instance.name, instance.filePath as instantiatedIn;

-- Cross-file dependency analysis via imports
MATCH (file1:SourceFile)-[:CONTAINS]->(alias:ImportAlias {importPath: path})
MATCH (file2:SourceFile {path: path})-[:EXPORTS]->(original)
MATCH (alias)-[:RESOLVES_TO]->(original)
RETURN file1.path as dependent, file2.path as dependency, 
       alias.localName, original.name, labels(original) as entityType;

-- Find import naming patterns (renamed imports)
MATCH (alias:ImportAlias)-[:RESOLVES_TO]->(original)
WHERE alias.localName <> alias.originalName  
RETURN alias.originalName, alias.localName, alias.filePath,
       labels(original) as entityType;

-- Class usage patterns: imported vs local
MATCH (class:Class)
OPTIONAL MATCH (local_instance:Variable)-[:INSTANCE_OF]->(class)
WHERE local_instance.filePath = class.filePath
OPTIONAL MATCH (alias:ImportAlias)-[:RESOLVES_TO]->(class)  
OPTIONAL MATCH (imported_instance:Variable)-[:INSTANCE_OF]->(class)
WHERE imported_instance.filePath <> class.filePath
RETURN class.name, class.filePath,
       count(DISTINCT local_instance) as local_instances,
       count(DISTINCT alias) as import_count,
       count(DISTINCT imported_instance) as remote_instances;
```

## Migration Path

1. **Phase 1**: Add new node tables alongside existing `CodeEntity`
2. **Phase 2**: Populate new tables from existing `CodeEntity` data using `kind` field
3. **Phase 3**: Create new relationships between new node types
4. **Phase 4**: Update analysis code to write to new schema
5. **Phase 5**: Remove old `CodeEntity` table and relationships

## Open Questions

1. ✅ **Relationship Explosion**: ~~Do we need separate CALLS tables for every combination, or can Kuzu handle polymorphic relationships?~~  
   **SOLVED!** Kuzu supports multiple FROM/TO pairs in single relationship tables with automatic union behavior.

2. ✅ **Property vs Variable**: ~~Should class properties be `Variable` nodes or separate `Property` nodes?~~  
   **SOLVED!** Method + Property vs Function + Variable captures the semantic distinction perfectly.
3. ✅ **Import Handling**: ~~How do we best represent imported functions/classes that are used locally?~~  
   **SOLVED!** ImportAlias entities + RESOLVES_TO relationships + INSTANCE_OF for class instantiation. Por que no los dos! 🌿
4. **Performance**: Will the increased number of tables impact query performance?
5. **Rust Integration**: How does this impact the current Rust ingestion pipeline?
6. **Data Loading**: How do we specify which FROM/TO pair when loading relationship data?

## Benefits

- ✅ Semantically clear and self-documenting
- ✅ Type-safe queries (no more filtering by `kind`)
- ✅ Rich type-specific metadata
- ✅ Natural relationship modeling
- ✅ Easier to extend with new entity types

## Risks

- ❌ Increased schema complexity
- ❌ More relationship tables to maintain
- ❌ Migration complexity
- ❌ Potential query performance impact
- ❌ More complex Rust ingestion logic