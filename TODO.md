# Graph Schema Migration - Complete Implementation Plan

## Overview 🎯

This document captures our comprehensive plan to evolve from the current "tagged union" approach (`CodeEntity` with `kind` field) to **first-class vertex types** with semantic relationships. This migration will unlock powerful query capabilities and make our graph database truly self-documenting.

## Key Design Principles Established 

### 1. SourceFile as Dual-Role Entity ✨
**BREAKTHROUGH INSIGHT**: SourceFile and Module are the same entity playing contextual roles:
- **Storage role**: Container of code on disk (file system perspective)  
- **Execution role**: Module that imports, exports, and executes code (runtime perspective)

This means SourceFile can:
- **CONTAIN** functions, classes, variables (as a file)
- **CALL** functions and methods (as executing module scope)
- **REFERENCE** variables (as executing module scope)
- **IMPORT** from other modules
- **EXPORT** its contained entities

### 2. Method + Property vs Function + Variable 🏗️
**Semantic distinction captures behavioral vs structural differences:**
- **Function**: Standalone behavior (top-level functions)
- **Method**: Class behavior (functions within classes)
- **Property**: Class state (data members within classes) 
- **Variable**: Scoped data (parameters, locals, module-level)

### 3. Polymorphic Relationships in Kuzu 🚀
**MAJOR DISCOVERY**: Kuzu supports multiple FROM/TO pairs in single relationship tables:
```sql
CREATE REL TABLE CALLS(
  FROM Function TO Function,
  FROM Method TO Function,
  FROM SourceFile TO Function,
  -- All combinations in one table!
);
```
- Internally creates separate tables for each combination
- Queries treat it as unified relationship with automatic union behavior
- **No relationship explosion problem!**

### 4. Import Handling Strategy 📦
**Two-pronged approach** (Por que no los dos! 🌿):
- **ImportAlias entities** + **RESOLVES_TO** relationships for compile-time name bindings
- **INSTANCE_OF relationships** for runtime object creation
- Handles both import aliases AND class instantiation elegantly

### 5. Hierarchical Containment 🌳
**Direct children only** - each container CONTAINS its immediate children:
- Walk graph with `[:CONTAINS*]` for deep traversal
- Clean semantic queries for specific nesting levels
- Proper scope modeling

## Architecture Overview

### Current State
```
CodeEntity(kind: "function"|"class"|...) → Generic relationships
```

### Target State  
```
Function, Class, Method, Property, Variable, Interface, etc. → Rich semantic relationships
```

## Detailed Migration Plan

### Phase 1: Rust Schema Evolution 🦀

#### 1.1 Update Schema Definition (`~/dev/kuzu-rust/src/schema.rs`)

**Replace current KUZU_SCHEMA_COMMANDS with:**

```rust
// First-class node tables
pub const KUZU_SCHEMA_COMMANDS: [&str; N] = [
    // Code entity types
    r#"CREATE NODE TABLE Function(
        id STRING,
        name STRING,
        isAsync BOOLEAN,
        isExported BOOLEAN,
        returnType STRING,
        parameters STRING[],
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE Class(
        id STRING,
        name STRING,
        isAbstract BOOLEAN,
        isExported BOOLEAN,
        superClass STRING,
        interfaces STRING[],
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE Method(
        id STRING,
        name STRING,
        isAsync BOOLEAN,
        isStatic BOOLEAN,
        visibility STRING, -- "public" | "private" | "protected"
        returnType STRING,
        parameters STRING[],
        className STRING,
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE Property(
        id STRING,
        name STRING,
        type STRING,
        isStatic BOOLEAN,
        visibility STRING,
        isReadonly BOOLEAN,
        isOptional BOOLEAN,
        defaultValue STRING,
        className STRING,
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE Variable(
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
    );"#,
    
    r#"CREATE NODE TABLE Interface(
        id STRING,
        name STRING,
        isExported BOOLEAN,
        extends STRING[],
        properties STRING[],
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE Enum(
        id STRING,
        name STRING,
        isConst BOOLEAN,
        isExported BOOLEAN,
        members STRING[],
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE TypeAlias(
        id STRING,
        name STRING,
        isExported BOOLEAN,
        definition STRING,
        typeParameters STRING[],
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    r#"CREATE NODE TABLE ImportAlias(
        id STRING,
        localName STRING,
        originalName STRING,
        importPath STRING,
        filePath STRING,
        line INT64,
        column INT64,
        startPos INT64,
        endPos INT64,
        signature STRING,
        PRIMARY KEY(id)
    );"#,
    
    // Enhanced SourceFile (dual-role entity)
    r#"CREATE NODE TABLE SourceFile(
        path STRING,
        extension STRING,
        isModule BOOLEAN,
        size INT64,
        totalLines INT64,
        entityCount INT64,
        relationshipCount INT64,
        PRIMARY KEY(path)
    );"#,
    
    // Keep existing organizational tables
    r#"CREATE NODE TABLE Project(...);"#,
    r#"CREATE NODE TABLE Application(...);"#,
    r#"CREATE NODE TABLE Package(...);"#,
    r#"CREATE NODE TABLE Dependency(...);"#,
    r#"CREATE NODE TABLE ExternalModule(...);"#,
    
    // Polymorphic relationship tables using Kuzu's multi-FROM/TO syntax
    r#"CREATE REL TABLE CALLS(
        FROM Function TO Function,
        FROM Method TO Function,
        FROM Method TO Method,
        FROM Function TO Method,
        FROM SourceFile TO Function,
        FROM SourceFile TO Method,
        evidence STRING,
        confidence STRING,
        isAsync BOOLEAN,
        metadata STRING
    );"#,
    
    r#"CREATE REL TABLE REFERENCES(
        FROM Function TO Variable,
        FROM Method TO Variable,
        FROM Method TO Property,
        FROM SourceFile TO Variable,
        FROM SourceFile TO Property,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    // Hierarchical containment (direct children only)
    r#"CREATE REL TABLE CONTAINS(
        FROM SourceFile TO Function,
        FROM SourceFile TO Class,
        FROM SourceFile TO Interface,
        FROM SourceFile TO Variable,
        FROM SourceFile TO Enum,
        FROM SourceFile TO TypeAlias,
        FROM SourceFile TO ImportAlias,
        FROM Class TO Method,
        FROM Class TO Property,
        FROM Function TO Variable,
        FROM Method TO Variable,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    // Import resolution & instantiation
    r#"CREATE REL TABLE RESOLVES_TO(
        FROM ImportAlias TO Function,
        FROM ImportAlias TO Class,
        FROM ImportAlias TO Interface,
        FROM ImportAlias TO Variable,
        FROM ImportAlias TO TypeAlias,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    r#"CREATE REL TABLE INSTANCE_OF(
        FROM Variable TO Class,
        FROM Property TO Class,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    // Enhanced usage through import aliases
    r#"CREATE REL TABLE CALLS(
        FROM SourceFile TO ImportAlias,
        FROM Function TO ImportAlias,
        FROM Method TO ImportAlias,
        evidence STRING,
        confidence STRING,
        isAsync BOOLEAN,
        metadata STRING
    );"#,
    
    r#"CREATE REL TABLE REFERENCES(
        FROM SourceFile TO ImportAlias,
        FROM Function TO ImportAlias,
        FROM Method TO ImportAlias,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    // Export relationships
    r#"CREATE REL TABLE EXPORTS(
        FROM SourceFile TO Function,
        FROM SourceFile TO Class,
        FROM SourceFile TO Interface,
        FROM SourceFile TO Variable,
        FROM SourceFile TO Enum,
        FROM SourceFile TO TypeAlias,
        evidence STRING,
        confidence STRING,
        exportType STRING,
        metadata STRING
    );"#,
    
    // Type system relationships
    r#"CREATE REL TABLE EXTENDS(
        FROM Class TO Class,
        FROM Interface TO Interface,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    r#"CREATE REL TABLE IMPLEMENTS(
        FROM Class TO Interface,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    r#"CREATE REL TABLE TYPE_OF(
        FROM Variable TO TypeAlias,
        FROM Variable TO Interface,
        FROM Property TO TypeAlias,
        FROM Property TO Interface,
        evidence STRING,
        confidence STRING,
        metadata STRING
    );"#,
    
    // Project hierarchy relationships (keep existing)
    r#"CREATE REL TABLE HAS_APPLICATION(...);"#,
    r#"CREATE REL TABLE HAS_PACKAGE(...);"#,
    r#"CREATE REL TABLE HAS_ENTRYPOINT(...);"#,
];
```

#### 1.2 Update Rust Structs for Type Safety

```rust
// Replace GraphEntity with specific structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Function {
    pub id: String,
    pub name: String,
    pub is_async: bool,
    pub is_exported: bool,
    pub return_type: String,
    pub parameters: Vec<String>,
    pub file_path: String,
    pub line: i64,
    // ... other fields
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Class {
    pub id: String,
    pub name: String,
    pub is_abstract: bool,
    // ... other fields
}

// ... other entity structs
```

#### 1.3 Update Ingestion Logic (`kuzu_ingestor.rs`)

**Replace `ingest_entities_by_kind` method:**
```rust
fn ingest_entities_by_kind(&self, conn: &Connection, kind: &str, entities: &[&GraphEntity]) {
    let (table_name, query) = match kind {
        "function" => ("Function", r#"CREATE (:Function {
            id: $id,
            name: $name,
            isAsync: $isAsync,
            isExported: $isExported,
            returnType: $returnType,
            parameters: $parameters,
            filePath: $filePath,
            line: $line,
            column: $column,
            startPos: $startPos,
            endPos: $endPos,
            signature: $signature
        });"#),
        "class" => ("Class", r#"CREATE (:Class { /* ... */ });"#),
        "method" => ("Method", r#"CREATE (:Method { /* ... */ });"#),
        // ... handle all new entity types
    };
    // ... rest of ingestion logic
}
```

**Update relationship ingestion for polymorphic types:**
```rust
fn ingest_relationship_batch_unwind(&self, conn: &Connection, relationship_type: &str, relationships: &[GraphRelationship]) {
    let query = match relationship_type {
        "CALLS" => r#"MATCH (a {id: $from}), (b {id: $to})
                      WHERE (a:Function OR a:Method OR a:SourceFile) 
                      AND (b:Function OR b:Method)
                      CREATE (a)-[:CALLS {
                          evidence: $evidence,
                          confidence: $confidence,
                          isAsync: $isAsync,
                          metadata: $metadata
                      }]->(b)"#,
        // ... handle other polymorphic relationships
    };
    // ... rest of relationship logic
}
```

### Phase 2: TypeScript Type Generation 🏭

#### 2.1 Add Build Script for Type Generation

**Create `~/dev/kuzu-rust/build.rs`:**
```rust
use std::fs;
use std::path::Path;

fn main() {
    // Generate TypeScript types from Rust structs
    let typescript_types = generate_typescript_types();
    
    // Write to ink-cli analysis package
    let output_path = "../ink-cli/packages/analysis/src/generated-types.ts";
    fs::write(output_path, typescript_types).expect("Failed to write TypeScript types");
    
    println!("cargo:rerun-if-changed=src/schema.rs");
}

fn generate_typescript_types() -> String {
    format!(r#"
// Generated from Rust schema - DO NOT EDIT MANUALLY
// Last generated: {}

export interface Function {{
  id: string;
  name: string;
  isAsync: boolean;
  isExported: boolean;
  returnType: string;
  parameters: string[];
  filePath: string;
  line: number;
  column: number;
  startPos: number;
  endPos: number;
  signature: string;
}}

export interface Class {{
  id: string;
  name: string;
  isAbstract: boolean;
  isExported: boolean;
  superClass: string;
  interfaces: string[];
  filePath: string;
  line: number;
  column: number;
  startPos: number;
  endPos: number;
  signature: string;
}}

// ... all other entity types

// Relationship types
export type ConfidenceLevel = "high" | "medium" | "low";

export interface CallsRelationship {{
  from: string;
  to: string;
  evidence: string;
  confidence: ConfidenceLevel;
  isAsync: boolean;
  metadata: Record<string, any>;
}}

// ... all other relationship types

// Query result types
export type CodeEntity = Function | Class | Method | Property | Variable | Interface | Enum | TypeAlias | ImportAlias;

// Schema constants (matching Rust)
export const RELATIONSHIP_TYPES = {RELATIONSHIP_TYPES:?} as const;
export const NODE_TYPES = {NODE_TYPES:?} as const;
"#, chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"))
}
```

#### 2.2 Update Cargo.toml Dependencies

```toml
[build-dependencies]
chrono = { version = "0.4", features = ["serde"] }

[dependencies]
# ... existing deps
serde_json = "1.0"
quote = "1.0"  # For advanced type generation if needed
```

### Phase 3: TypeScript Side Updates 📝

#### 3.1 Update Analysis Package

**Replace `packages/analysis/src/types.ts`:**
```typescript
// Re-export generated types
export * from './generated-types.js';

// Keep any additional hand-written types that aren't generated
export interface AnalysisOptions {
  context?: number;
  calls?: string | boolean;
  types?: boolean;
  // ... existing options
}

// Query builder helpers
export class QueryBuilder {
  static findFunctionsInFile(filePath: string): string {
    return `
      MATCH (file:SourceFile {path: "${filePath}"})-[:CONTAINS]->(f:Function)
      RETURN f
    `;
  }
  
  static findCallsToFunction(functionName: string): string {
    return `
      MATCH (caller)-[:CALLS]->(f:Function {name: "${functionName}"})
      RETURN caller, labels(caller) as callerType, f
    `;
  }
  
  // ... more query builders
}
```

#### 3.2 Update Graph Schema Constants

**Replace `packages/analysis/src/graph/schema.ts`:**
```typescript
// Import generated constants from Rust
import { RELATIONSHIP_TYPES, NODE_TYPES, KUZU_SCHEMA_COMMANDS } from '../generated-types.js';

// Re-export for backward compatibility
export { RELATIONSHIP_TYPES, NODE_TYPES };

// The DDL commands are now generated from Rust
export { KUZU_SCHEMA_COMMANDS };

// Helper functions using generated types
export function isCodeEntity(nodeType: string): boolean {
  return ['Function', 'Class', 'Method', 'Property', 'Variable', 'Interface', 'Enum', 'TypeAlias'].includes(nodeType);
}
```

### Phase 4: Analysis Engine Updates ⚙️

#### 4.1 Update Graph Analyzer (`packages/analysis/src/engine/graph-analyzer.ts`)

**Key changes needed:**
```typescript
// Update entity creation to use specific types
function createCodeEntities(fileResult: FileAnalysisResult): CodeEntity[] {
  const entities: CodeEntity[] = [];
  
  for (const entity of fileResult.entities) {
    switch (entity.type) {
      case 'function':
        entities.push(createFunctionEntity(entity));
        break;
      case 'class':
        entities.push(createClassEntity(entity));
        break;
      case 'method':
        entities.push(createMethodEntity(entity));
        break;
      case 'variable':
        // Determine if it's a Property or Variable based on context
        if (entity.parentScopeType === 'class') {
          entities.push(createPropertyEntity(entity));
        } else {
          entities.push(createVariableEntity(entity));
        }
        break;
      // ... handle all entity types
    }
  }
  
  return entities;
}

function createFunctionEntity(entity: JavaScriptEntity): Function {
  return {
    id: entity.id || generateId(entity),
    name: entity.name,
    isAsync: entity.isAsync || false,
    isExported: entity.isExported || false,
    returnType: extractReturnType(entity.signature),
    parameters: extractParameters(entity.signature),
    filePath: entity.filePath || '',
    line: entity.line,
    column: 0, // Extract from signature if available
    startPos: 0,
    endPos: 0, 
    signature: entity.signature
  };
}

// ... similar functions for other entity types
```

#### 4.2 Update Relationship Creation Logic

**Handle the new semantic relationships:**
```typescript
// Create polymorphic CALLS relationships
function createCallsRelationships(fileResult: FileAnalysisResult, entities: Map<string, CodeEntity>): GraphRelationship[] {
  const relationships: GraphRelationship[] = [];
  
  for (const callExpr of fileResult.callExpressions) {
    const caller = findCallerEntity(callExpr, entities);
    const callee = findCalleeEntity(callExpr, entities);
    
    if (caller && callee) {
      relationships.push({
        from: caller.id,
        to: callee.id,
        type: 'CALLS',
        evidence: `${callExpr.type} call: ${callExpr.signature}`,
        confidence: 'high',
        metadata: {
          isAsync: callExpr.isAsync || false,
          argumentCount: callExpr.argumentCount,
          line: callExpr.line
        }
      });
    }
  }
  
  return relationships;
}

// Create CONTAINS relationships (hierarchical, direct children only)
function createContainsRelationships(entities: CodeEntity[]): GraphRelationship[] {
  const relationships: GraphRelationship[] = [];
  
  // Group by file path
  const entitiesByFile = groupBy(entities, e => e.filePath);
  
  for (const [filePath, fileEntities] of entitiesByFile) {
    const sourceFileId = `SourceFile:${filePath}`;
    
    // File contains top-level entities (no parentScopeId)
    const topLevelEntities = fileEntities.filter(e => !e.parentScopeId);
    for (const entity of topLevelEntities) {
      relationships.push({
        from: sourceFileId,
        to: entity.id,
        type: 'CONTAINS',
        evidence: `File ${filePath} contains top-level ${getEntityType(entity)}`,
        confidence: 'high',
        metadata: {
          scopeType: 'file',
          containedType: getEntityType(entity),
          isTopLevel: true
        }
      });
    }
    
    // Class contains methods and properties
    const classes = fileEntities.filter(e => getEntityType(e) === 'Class');
    for (const classEntity of classes) {
      const classMembers = fileEntities.filter(e => 
        e.parentScopeId === classEntity.id || 
        (e as any).className === classEntity.name
      );
      
      for (const member of classMembers) {
        relationships.push({
          from: classEntity.id,
          to: member.id,
          type: 'CONTAINS',
          evidence: `Class ${classEntity.name} contains ${getEntityType(member)} ${member.name}`,
          confidence: 'high',
          metadata: {
            scopeType: 'class',
            containedType: getEntityType(member),
            isClassMember: true
          }
        });
      }
    }
    
    // Function/Method contains local variables
    const callables = fileEntities.filter(e => 
      ['Function', 'Method'].includes(getEntityType(e))
    );
    
    for (const callable of callables) {
      const localVars = fileEntities.filter(e => 
        getEntityType(e) === 'Variable' && e.parentScopeId === callable.id
      );
      
      for (const localVar of localVars) {
        relationships.push({
          from: callable.id,
          to: localVar.id,
          type: 'CONTAINS',
          evidence: `${getEntityType(callable)} ${callable.name} contains local variable ${localVar.name}`,
          confidence: 'high',
          metadata: {
            scopeType: getEntityType(callable).toLowerCase(),
            containedType: 'variable',
            isLocal: true
          }
        });
      }
    }
  }
  
  return relationships;
}
```

### Phase 5: Migration Strategy 🚀

#### 5.1 Backward Compatibility Plan

**Dual Schema Approach (Temporary):**
```rust
// Support both old and new schemas during transition
pub const MIGRATION_MODE: bool = true;

pub const LEGACY_SCHEMA_COMMANDS: [&str; N] = [
    // Current CodeEntity-based schema
];

pub const NEW_SCHEMA_COMMANDS: [&str; M] = [
    // New first-class vertex schema
];

impl KuzuIngestor {
    pub fn initialize_with_migration(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if MIGRATION_MODE {
            // Create both schemas
            self.create_schema(&LEGACY_SCHEMA_COMMANDS)?;
            self.create_schema(&NEW_SCHEMA_COMMANDS)?;
        } else {
            self.create_schema(&NEW_SCHEMA_COMMANDS)?;
        }
        Ok(())
    }
}
```

#### 5.2 Migration Command

**Add to `main.rs`:**
```rust
"migrate" => {
    if args.len() < 3 {
        eprintln!("Usage: {} migrate <db_path>", args[0]);
        return Ok(());
    }
    
    let db_path = &args[2];
    let mut ingestor = KuzuIngestor::new(db_path)?;
    
    // 1. Read existing CodeEntity data
    let legacy_data = ingestor.export_legacy_data()?;
    
    // 2. Transform to new schema
    let new_data = transform_legacy_to_new_schema(legacy_data)?;
    
    // 3. Create new schema
    ingestor.initialize_new_schema()?;
    
    // 4. Ingest transformed data
    ingestor.ingest_new_schema_data(new_data)?;
    
    println!("Migration completed successfully!");
}
```

### Phase 6: Testing & Validation 🧪

#### 6.1 Schema Validation Tests

**Create comprehensive test suite:**
```rust
#[cfg(test)]
mod schema_tests {
    use super::*;

    #[test]
    fn test_polymorphic_calls_relationship() {
        // Test that CALLS relationship works across all entity types
        let mut ingestor = KuzuIngestor::new(":memory:").unwrap();
        ingestor.initialize().unwrap();
        
        // Create entities of different types
        let function_entity = create_test_function();
        let method_entity = create_test_method();
        let sourcefile_entity = create_test_sourcefile();
        
        // Create CALLS relationships
        let call_relationships = vec![
            create_calls_relationship(&function_entity.id, &method_entity.id),
            create_calls_relationship(&sourcefile_entity.path, &function_entity.id),
        ];
        
        // Test ingestion
        ingestor.ingest_entities(&[function_entity, method_entity, sourcefile_entity]).unwrap();
        ingestor.ingest_relationships(&call_relationships).unwrap();
        
        // Test queries
        let result = ingestor.query("MATCH (caller)-[:CALLS]->(target) RETURN count(*)").unwrap();
        assert_eq!(parse_count_result(&result), 2);
    }

    #[test]
    fn test_hierarchical_containment() {
        // Test that CONTAINS relationships form proper hierarchy
        // SourceFile -> Class -> Method -> Variable
    }

    #[test]
    fn test_import_alias_resolution() {
        // Test ImportAlias -> RESOLVES_TO -> original entity
    }

    #[test]
    fn test_instance_of_relationships() {
        // Test Variable -> INSTANCE_OF -> Class
    }
}
```

#### 6.2 Performance Benchmarks

```rust
#[cfg(test)]
mod performance_tests {
    #[test]
    fn benchmark_ingestion_speed() {
        // Compare old vs new schema ingestion performance
        // Target: Maintain ~8,500 entities/second performance
    }

    #[test] 
    fn benchmark_query_performance() {
        // Test query performance on new schema
        // Compare against current query times
    }
}
```

#### 6.3 Integration Tests

**Test end-to-end flow:**
```typescript
// packages/analysis/src/__tests__/schema-integration.test.ts
describe('New Schema Integration', () => {
  test('analyzeToGraph produces valid entities for new schema', () => {
    const files = ['test-fixtures/sample.ts'];
    const result = analyzeToGraph(files);
    
    // Verify entities have correct structure
    const functions = result.entities.filter(e => e.kind === 'Function');
    expect(functions).toHaveLength(3);
    
    const classes = result.entities.filter(e => e.kind === 'Class');  
    expect(classes).toHaveLength(1);
    
    // Verify relationships are created correctly
    const callsRels = result.relationships.filter(r => r.type === 'CALLS');
    const containsRels = result.relationships.filter(r => r.type === 'CONTAINS');
    
    expect(callsRels.length).toBeGreaterThan(0);
    expect(containsRels.length).toBeGreaterThan(0);
  });

  test('import alias handling works correctly', () => {
    // Test ImportAlias entity creation and RESOLVES_TO relationships
  });

  test('class instantiation creates INSTANCE_OF relationships', () => {
    // Test Variable -> INSTANCE_OF -> Class relationships
  });
});
```

### Phase 7: Documentation & Query Examples 📚

#### 7.1 Update README with New Capabilities

**Add powerful query examples showcasing new schema:**

```cypher
-- Find all async functions that call other functions
MATCH (f:Function {isAsync: true})-[:CALLS]->(target:Function)
RETURN f.name, f.filePath, target.name, target.filePath;

-- Show class hierarchy and usage patterns  
MATCH (c:Class)
OPTIONAL MATCH (c)-[:CONTAINS]->(m:Method)
OPTIONAL MATCH (instance:Variable)-[:INSTANCE_OF]->(c)
RETURN c.name, c.filePath, count(m) as methods, count(instance) as instances;

-- Import dependency analysis
MATCH (file:SourceFile)-[:CONTAINS]->(alias:ImportAlias)-[:RESOLVES_TO]->(original)
RETURN file.path as importer, alias.localName, original.name, labels(original) as entityType, alias.importPath;

-- Find unused exports
MATCH (file:SourceFile)-[:EXPORTS]->(exported)
WHERE NOT EXISTS { MATCH ()-[:CALLS|REFERENCES]->(exported) }
RETURN file.path, exported.name, labels(exported) as entityType;

-- Cross-file function call graph  
MATCH (caller:Function)-[:CALLS]->(callee:Function)
WHERE caller.filePath <> callee.filePath
RETURN caller.name, caller.filePath, callee.name, callee.filePath;

-- Module-level side effects (top-level calls)
MATCH (file:SourceFile)-[:CALLS]->(target)
RETURN file.path, target.name, labels(target) as targetType;

-- Class dependency graph
MATCH (c1:Class)-[:CONTAINS]->(m:Method)-[:CALLS]->(target)
MATCH (c2:Class)-[:CONTAINS]->(target)
WHERE c1 <> c2
RETURN c1.name as from_class, c2.name as to_class, count(*) as call_count;

-- Type usage analysis
MATCH (entity)-[:TYPE_OF]->(type:Interface)
RETURN type.name, labels(entity) as entityTypes, count(entity) as usage_count
ORDER BY usage_count DESC;

-- Scope analysis (containment hierarchy)
MATCH path = (file:SourceFile)-[:CONTAINS*]->(entity)
RETURN file.path, entity.name, labels(entity) as entityType, length(path) as nesting_level
ORDER BY file.path, nesting_level;
```

#### 7.2 Query Performance Guide

**Best practices for the new schema:**

```markdown
## Query Performance Tips

### 1. Leverage Specific Node Types
✅ `MATCH (f:Function)` - Direct node type access
❌ `MATCH (e:CodeEntity) WHERE e.kind = "function"` - Generic filtering

### 2. Use Hierarchical Queries Efficiently  
✅ `MATCH (file:SourceFile)-[:CONTAINS]->(entity)` - Direct children
✅ `MATCH (file:SourceFile)-[:CONTAINS*2..3]->(entity)` - Specific depth range
❌ `MATCH (file:SourceFile)-[:CONTAINS*]->(entity)` - Unbounded traversal

### 3. Index Usage
- Primary keys (id, path) are automatically indexed
- Consider creating indexes on frequently queried properties:
  ```cypher
  CREATE INDEX IF NOT EXISTS FOR (f:Function) ON (f.name);
  CREATE INDEX IF NOT EXISTS FOR (c:Class) ON (c.name);
  ```

### 4. Polymorphic Relationship Queries
- Kuzu automatically optimizes polymorphic CALLS/REFERENCES relationships  
- Query them naturally without worrying about internal table structure
```

## Timeline & Milestones 📅

### Week 1: Foundation
- [ ] Update Rust schema definition (`schema.rs`)
- [ ] Implement basic type generation (`build.rs`)
- [ ] Update core ingestion logic
- [ ] Basic smoke tests

### Week 2: Core Implementation  
- [ ] Complete entity creation logic in graph-analyzer
- [ ] Implement all relationship types
- [ ] Update TypeScript types and imports
- [ ] Comprehensive unit tests

### Week 3: Integration & Testing
- [ ] End-to-end integration tests
- [ ] Performance benchmarking vs current implementation
- [ ] Migration tooling
- [ ] Documentation updates

### Week 4: Validation & Polish
- [ ] Large codebase testing
- [ ] Query performance optimization  
- [ ] Final documentation and examples
- [ ] Production readiness review

## Success Metrics 📊

### Performance Targets
- **Ingestion Speed**: Maintain ≥8,500 entities/second (current: ~8,500/sec)
- **Query Performance**: New semantic queries ≤2x slower than current generic queries
- **Memory Usage**: Stay within 20% of current memory footprint
- **Database Size**: New schema ≤1.5x current database size

### Functionality Goals
- **100% Feature Parity**: All current analysis capabilities maintained
- **New Query Power**: 10+ new query patterns enabled by semantic schema
- **Type Safety**: Zero type-related runtime errors in TypeScript
- **Documentation**: Complete query examples and migration guide

### Quality Targets  
- **Test Coverage**: ≥90% coverage on new schema logic
- **Migration Success**: 100% data fidelity in schema migration
- **Backward Compatibility**: Smooth transition path for existing users
- **Developer Experience**: Clear error messages, good debugging support

## Risk Mitigation 🛡️

### Technical Risks
1. **Performance Degradation**
   - Mitigation: Extensive benchmarking, query optimization
   - Rollback: Keep legacy schema as fallback

2. **Data Migration Issues**
   - Mitigation: Comprehensive migration testing, data validation
   - Rollback: Dual-schema approach during transition

3. **Kuzu Compatibility Issues**
   - Mitigation: Version pinning, thorough testing of polymorphic relationships
   - Rollback: Simplify to single FROM/TO relationships if needed

### Project Risks
1. **Complexity Creep**
   - Mitigation: Phased approach, clear milestones
   - Management: Regular progress reviews, scope control

2. **Breaking Changes Impact**
   - Mitigation: Semantic versioning, clear migration path
   - Communication: Early user notification, comprehensive docs

## Notes & Insights 💡

### Key Technical Insights From Discussion
1. **SourceFile dual role**: Storage + execution context eliminates artificial separation
2. **Kuzu polymorphic relationships**: Native support eliminates relationship explosion concern
3. **Method+Property vs Function+Variable**: Semantic distinction captures behavioral vs structural differences  
4. **Import handling**: ImportAlias entities + RESOLVES_TO relationships elegantly handle compile-time bindings
5. **Hierarchical containment**: Direct children only approach enables both efficient direct queries and flexible graph traversal
6. **Performance optimization**: File-by-file streaming with type-grouped batching maintains excellent performance characteristics

### Design Philosophy  
- **Semantic clarity over implementation simplicity**: The graph should be self-documenting
- **Query power over storage efficiency**: Rich relationships enable powerful analysis  
- **Type safety over flexibility**: Catch errors at compile time, not runtime
- **Performance preservation**: Don't sacrifice speed for features

### Future Extensibility
- Schema designed to easily add new entity types (e.g., Decorator, Annotation)
- Relationship system supports new semantic connections
- Type generation approach scales to any Rust struct additions
- Migration tooling provides pattern for future schema evolution

---

## Conclusion 🎉

This comprehensive migration plan transforms our graph database from a generic entity storage system into a rich, semantic code analysis platform. The new schema unlocks powerful query capabilities while maintaining the performance characteristics that make our analysis fast and scalable.

The key breakthrough insights around SourceFile dual roles, Kuzu's polymorphic relationship support, and the Method/Property vs Function/Variable distinction create a foundation for unprecedented code analysis capabilities.

**Next step: Begin Phase 1 implementation! 🚀**