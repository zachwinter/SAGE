import { tool } from "@lmstudio/sdk";
import { RustKuzuIngestor } from "@sage/graph";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const SCHEMA = `
## 🧠 Agent Onboarding Guide: Code Graph Database

### 🏗️ Graph Schema Overview

**Node Types (First-Class Entities):**

**🎯 Code Entities** - Semantic, strongly-typed nodes:
- **Function** - Standalone functions
- **Method** - Class methods
- **Class** - Class definitions
- **Property** - Class properties
- **Variable** - Scoped variables (parameters, locals, module-level)
- **Interface** - TypeScript interfaces
- **Enum** - Enumerations
- **TypeAlias** - Type aliases
- **ImportAlias** - Import statements and bindings
- **ExportAlias** - Export declarations

**📁 Organizational Entities:**
- **SourceFile** - Files (dual-role: storage + execution context)
- **Package** - Monorepo packages
- **Project** - Root project
- **Application** - Applications within projects
- **Dependency** - External dependencies
- **ExternalModule** - External modules

### 🔗 Relationship Types:

**Key Relationships:**
1. **CALLS** - Function/method invocation
   - Function → Function
   - Method → Function
   - Method → Method
   - SourceFile → Function
   - SourceFile → Method
   - Function → ImportAlias
   - Method → ImportAlias
   - SourceFile → ImportAlias

2. **REFERENCES** - Variable/property access
   - Function → Variable
   - Method → Variable
   - Method → Property
   - SourceFile → Variable
   - SourceFile → Property
   - Function → ImportAlias
   - Method → ImportAlias
   - SourceFile → ImportAlias

3. **CONTAINS** - Hierarchical containment (direct children only)
   - SourceFile → Function (top-level functions)
   - SourceFile → Class (top-level classes)
   - SourceFile → Interface (top-level interfaces)
   - SourceFile → Variable (module-scoped variables)
   - SourceFile → Enum (top-level enums)
   - SourceFile → TypeAlias (top-level type aliases)
   - SourceFile → ImportAlias (import statements)
   - Class → Method (class methods)
   - Class → Property (class properties)
   - Function → Variable (local variables)
   - Method → Variable (local variables)

4. **EXPORTS** - Export declarations
   - SourceFile → Function
   - SourceFile → Class
   - SourceFile → Interface
   - SourceFile → Variable
   - SourceFile → Enum
   - SourceFile → TypeAlias

5. **RESOLVES_TO** - Import resolution
   - ImportAlias → Function
   - ImportAlias → Class
   - ImportAlias → Interface
   - ImportAlias → Variable
   - ImportAlias → TypeAlias
   - ImportAlias → Enum

6. **INSTANCE_OF** - Class instantiation
   - Variable → Class
   - Property → Class

7. **Project Hierarchy**
   - Project → Application (HAS_APPLICATION)
   - Project → Package (HAS_PACKAGE)
   - Application → SourceFile (HAS_ENTRYPOINT)

8. **Dependency Relationships**
   - Package → Dependency (DEPENDS_ON)
   - ImportAlias → Dependency (USES_DEPENDENCY)
   - ImportAlias → ExternalModule (IMPORTS_EXTERNAL)

9. **Type System**
   - Class → Class (EXTENDS)
   - Interface → Interface (EXTENDS)
   - Class → Interface (IMPLEMENTS)
   - Variable → TypeAlias (TYPE_OF)
   - Variable → Interface (TYPE_OF)
   - Property → TypeAlias (TYPE_OF)
   - Property → Interface (TYPE_OF)

### 🚀 Agent Quick Start Queries:

\`\`\`cypher
// 🔍 Explore the codebase overview
MATCH (n) RETURN labels(n) as node_type, count(*) as count;

// 🎯 Understand code entity distribution  
MATCH (n) WHERE n:Function OR n:Method OR n:Class OR n:Property OR n:Variable OR n:Interface OR n:Enum OR n:TypeAlias
RETURN labels(n) as entity_type, count(*) as count ORDER BY count DESC;

// 🏗️ See project structure
MATCH (p:Project)-[:HAS_PACKAGE]->(pkg:Package) 
RETURN p.name as project_name, collect(pkg.name) as packages;

// 🔍 Find functions and their local variables (scope analysis)
MATCH (fn:Function)-[:CONTAINS]->(v:Variable) 
RETURN fn.name as function_name, collect(v.name) as local_variables;

// 📞 Analyze function call patterns
MATCH (caller)-[:CALLS]->(callee:Function) 
RETURN labels(caller) as caller_type, callee.name as callee_name, count(*) as call_count 
ORDER BY call_count DESC;

// 🏛️ See class structure (methods and properties)
MATCH (cls:Class)-[:CONTAINS]->(member) 
RETURN cls.name as class_name, labels(member) as member_type, member.name as member_name;

// 🌐 Import resolution patterns
MATCH (alias:ImportAlias)-[:RESOLVES_TO]->(target) 
RETURN alias.localName, alias.importPath, labels(target) as target_type, target.name 
LIMIT 10;

// 🔗 Find class instantiation patterns
MATCH (instance:Variable)-[:INSTANCE_OF]->(cls:Class) 
RETURN cls.name as class_name, count(instance) as instantiation_count 
ORDER BY instantiation_count DESC;
\`\`\`

### 💡 Agent Tips for Code Analysis:

**🎯 Scope Analysis (CONTAINS relationships):**
- Use CONTAINS to understand variable accessibility
- Perfect for refactoring impact analysis
- Great for finding all class members or function locals
- Use [:CONTAINS*] for deep traversal (all descendants)

**📞 Call Graph Analysis (CALLS relationships):**
- Track function dependencies and usage
- Find entry points and dead code
- Analyze coupling between components
- Works across all function/method types

**🏗️ First-Class Entity Benefits:**
- No more filtering by kind field
- Type-safe queries with rich metadata
- Semantic distinction between Methods vs Functions, Properties vs Variables
- Natural relationship modeling

**🔍 Query Performance Tips:**
- Use specific labels: \`:Function\` instead of filtering later
- Leverage relationship directions for better performance
- Use LIMIT for exploratory queries on large result sets
- Use EXISTS for existence checks instead of counting

**⚠️ Schema Design Notes:**
- SourceFile serves dual-role: storage container AND execution context
- CONTAINS relationships are hierarchical (direct children only)
- Use [:CONTAINS*] for deep traversal of nested scopes
- ImportAlias entities + RESOLVES_TO relationships for import resolution
- INSTANCE_OF relationships for class instantiation tracking
`;

export const GraphQuery = tool({
  name: "GraphQuery",
  description: `Execute custom Cypher queries against the project code graph.

${SCHEMA}`,
  parameters: {
    query: z
      .string()
      .describe("The Cypher query to execute against the code graph."),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of results to return")
  },
  implementation: async ({ query, limit }) => {
    const dbPath = join(process.cwd(), ".sage", "code.kuzu");

    // Check if the database exists
    if (!existsSync(dbPath)) {
      return {
        error:
          "No code graph database found. Run 'sage ingest' first to analyze your codebase."
      };
    }

    try {
      let finalQuery = query;
      if (limit && !query.toLowerCase().includes("limit")) {
        finalQuery = `${query} LIMIT ${limit}`;
      }

      const ingestor = new RustKuzuIngestor(dbPath);
      const result = await ingestor.query(finalQuery);

      return {
        success: true,
        results: result,
        query: finalQuery
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        query: query
      };
    }
  }
});
