# Analysis Package Enhancement TODO

## Core Graph Model Improvements

### ✅ Current State
- [x] Basic graph representation (GraphEntity + GraphRelationship)
- [x] CONTAINS, CALLS, IMPORTS relationships
- [x] Multi-language support (TS/JS + Rust)
- [x] Kuzu integration with streaming ingestion
- [x] Sub-2-second ingestion for ~200 files 🚀

### 🔥 High Priority Enhancements

#### 1. Remove CONTAINS Clutter
- [ ] Remove CONTAINS relationships (file containment is redundant with `filePath` property)
- [ ] Update graph-analyzer.ts to skip CONTAINS generation
- [ ] Verify queries still work with filePath property queries

#### 2. Explicit Module I/O Modeling
- [ ] Add EXPORTS relationships: `SourceFile --EXPORTS--> Function/Class/Interface`
- [ ] Add RE_EXPORTS relationships for barrel files
- [ ] Add granular USES relationships: `Function --USES--> Function` (cross-module)
- [ ] Add inheritance relationships: `Class --EXTENDS--> Class`, `Interface --IMPLEMENTS--> Interface`

#### 3. Dependencies as First-Class Citizens
- [ ] Parse package.json for dependency information
- [ ] Create PackageNode type with version info
- [ ] Add --deps flag to sage ingest command
- [ ] Add relationships: `Project --DEPENDS_ON--> Package`, `SourceFile --IMPORTS--> Package`
- [ ] Support dependency types: dependency, devDependency, peerDependency
- [ ] Optional: Parse actual node_modules code for external function usage

### 🚀 Advanced Features

#### 4. Test Relationships
- [ ] Add TEST node types and relationships
- [ ] `TestFile --TESTS--> Function/Class`
- [ ] `TestCase --COVERS--> CodePath`
- [ ] Coverage gap analysis queries

#### 5. Configuration as Graph Nodes
- [ ] Parse tsconfig.json, eslint configs, etc.
- [ ] `ConfigFile --CONFIGURES--> SourceFile`
- [ ] Config change impact analysis

#### 6. Type Usage Relationships
- [ ] `Function --ACCEPTS--> TypeNode`
- [ ] `Function --RETURNS--> TypeNode`
- [ ] Type impact analysis for refactoring

#### 7. Error & Async Boundaries
- [ ] `Function --THROWS--> ErrorType`
- [ ] `Function --CATCHES--> ErrorType`
- [ ] `Function --AWAITS--> Promise<T>`
- [ ] Error propagation and async waterfall analysis

#### 8. Build & Bundling Metadata
- [ ] Parse webpack/build configs
- [ ] `Bundle --INCLUDES--> SourceFile`
- [ ] Code splitting impact analysis

### 🔍 Potential Advanced Features

#### 9. Git Metadata Integration
- [ ] `Author --AUTHORED--> Function`
- [ ] `Commit --MODIFIED--> Function`
- [ ] Code hotspot and ownership analysis

#### 10. Performance & Database Boundaries
- [ ] `Function --QUERIES--> Database`
- [ ] Database usage impact analysis

## Implementation Notes

### Graph Schema Updates Needed
```typescript
// New node types
interface PackageNode extends GraphEntity {
  kind: "Package"
  version: string
  dependencyType: "dependency" | "devDependency" | "peerDependency"
}

interface ConfigNode extends GraphEntity {
  kind: "Config"
  configType: "tsconfig" | "eslint" | "webpack" | etc
}

interface TestNode extends GraphEntity {
  kind: "Test"
  testType: "unit" | "integration" | "e2e"
}

// New relationship types
type RelationshipType = 
  | "CALLS" | "IMPORTS" 
  | "EXPORTS" | "RE_EXPORTS" | "USES"
  | "EXTENDS" | "IMPLEMENTS" 
  | "DEPENDS_ON" | "CONFIGURES" | "TESTS"
  | "ACCEPTS" | "RETURNS" | "THROWS" | "CATCHES" | "AWAITS"
  | "INCLUDES" | "AUTHORED" | "MODIFIED" | "QUERIES"
```

### CLI Updates Needed
- [ ] Add `--deps` flag to sage ingest
- [ ] Add `--include-tests` flag
- [ ] Add `--include-configs` flag
- [ ] Add `--include-git` flag for metadata

## Killer Queries This Unlocks

- "What would break if I change this exported function?"
- "Which external packages does this function transitively depend on?"
- "Show me all untested code"
- "Find dead dependencies"
- "What's the blast radius of changing this type?"
- "Show me the async waterfall for this request"
- "Which functions are the most error-prone?" (most THROWS relationships)
- "Find barrel files" (high RE_EXPORTS count)
- "Show me the public API surface"
- "Code ownership hotspots"

---

## 🌀 Future Roadmap

### Phase 1: Graph-Native Agent Interface
- [ ] `UpdateCodeEntity(entityId, changes)` tool
- [ ] Blast radius analysis for all changes
- [ ] Graph-driven agent onboarding

### Phase 2: Specification-to-Code
- [ ] Model APIs/specs in graph
- [ ] Generate implementation from graph queries
- [ ] Graph as single source of truth

### Phase 3: Cognition as Data 🧠
- [ ] Question, Hypothesis, Footgun nodes
- [ ] Collective intelligence queries
- [ ] Institutional memory preservation

---

*Let's build the most comprehensive code graph system ever! 🔥*