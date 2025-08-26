import { tool } from "@lmstudio/sdk";
import { RustKuzuIngestor } from "@sage/analysis";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const SCHEMA = `
## 🧠 Agent Onboarding Guide: Code Graph Database

### 🏗️ Graph Schema Overview

**Node Types:**

**🎯 CodeEntity** - The Heart of Code Analysis
Represents code constructs with their semantic information:
- **variable** - Local vars, parameters, properties
- **import** - Import statements and bindings  
- **function** - Functions, methods, arrow functions
- **export** - Export declarations
- **interface** - TypeScript interfaces
- **implementation** - Rust trait implementations (impl blocks)
- **type** - Type definitions
- **type-alias** - Type aliases
- **struct** - Rust structs
- **module** - Module definitions
- **class** - Class definitions  
- **enum** - Enumerations
- **constant** - Constants

**📁 SourceFile** - File metadata and structure
**📦 Package** - Monorepo packages (@sage/*)
**🌐 ExternalModule** - Third-party dependencies
**🏢 Application & Project** - Project structure nodes

### 🔗 Relationship Types:

**Key Relationships:**
1. **CONTAINS** - Scope-based containment (NOT file-based!)
   - function → variable - Local variables in function scope
   - class → function - Methods in classes  
   - function → function - Nested functions/closures
   - class → variable - Class properties

2. **CALLS** - Function call relationships
   - function → function - Function calling function
   - function → import - Functions calling imported items
   - function → variable - Functions accessing variables

3. **EXPORTS** - Export declarations

4. **HAS_APPLICATION** - Project structure
5. **HAS_PACKAGE** - Project structure

### 🚀 Agent Quick Start Queries:

\`\`\`cypher
// 🔍 Explore the codebase overview
MATCH (n) RETURN labels(n) as node_type, count(*) as count;

// 🎯 Understand code entity distribution  
MATCH (c:CodeEntity) RETURN c.kind as entity_kind, count(*) as count ORDER BY count DESC;

// 🏗️ See monorepo structure
MATCH (p:Package) RETURN p.name as package_name, p.path as package_path;

// 🔍 Find functions and their local variables (scope analysis)
MATCH (fn:CodeEntity {kind: 'function'})-[:CONTAINS]->(v:CodeEntity {kind: 'variable'}) 
RETURN fn.name as function_name, collect(v.name) as local_variables;

// 📞 Analyze function call patterns
MATCH (caller:CodeEntity)-[:CALLS]->(callee:CodeEntity) 
RETURN caller.kind as caller_type, callee.kind as callee_type, count(*) as call_count 
ORDER BY call_count DESC;

// 🏛️ See class structure (methods and properties)
MATCH (cls:CodeEntity {kind: 'class'})-[:CONTAINS]->(member:CodeEntity) 
RETURN cls.name as class_name, member.kind as member_type, member.name as member_name;

// 🌐 External module usage patterns
MATCH (e:ExternalModule) 
RETURN e.name as module_name, count(*) as usage_count 
ORDER BY usage_count DESC;

// 🔗 Find nested scopes (3-level containment)
MATCH (parent:CodeEntity)-[:CONTAINS]->(child:CodeEntity)-[:CONTAINS]->(grandchild:CodeEntity) 
RETURN parent.kind + '→' + child.kind + '→' + grandchild.kind as scope_chain, 
       parent.name as parent_name, child.name as child_name, grandchild.name as grandchild_name;
\`\`\`

### 💡 Agent Tips for Code Analysis:

**🎯 Scope Analysis (CONTAINS relationships):**
- Use CONTAINS to understand variable accessibility
- Perfect for refactoring impact analysis
- Great for finding all class members or function locals

**📞 Call Graph Analysis (CALLS relationships):**
- Track function dependencies and usage
- Find entry points and dead code
- Analyze coupling between components

**🏗️ Multi-Language Support:**
- Handles TypeScript/JavaScript AND Rust code
- Different entity kinds for different languages (e.g., 'implementation' for Rust impl blocks)
- Consistent relationship patterns across languages

**🔍 Query Performance Tips:**
- Use specific kinds: \`{kind: 'function'}\` instead of filtering later
- Leverage relationship directions for better performance
- Use LIMIT for exploratory queries on large result sets

**⚠️ Schema Evolution Notes:**
- This is a living schema - new languages/constructs may add entity kinds
- CONTAINS relationships are semantic scope (not file containment)
- External modules may have duplicate entries (design choice for flexibility)
`;

export const GraphQuery = tool({
  name: "GraphQuery",
  description: `Execute custom Cypher queries against the project code graph.\n\n${SCHEMA}`,
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
