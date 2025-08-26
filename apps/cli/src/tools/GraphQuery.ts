import { tool } from "@lmstudio/sdk";
import { RustKuzuIngestor } from "@sage/analysis";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const SCHEMA = `
## Database Schema

### Node Types (Tables):
- **CodeEntity**: Functions, classes, variables, etc. (id, kind, name, text, filePath, lineNum, colNum, startPos, endPos, nodeFlags)
- **SourceFile**: Source files (path, extension, size, totalLines, entityCount, relationshipCount)
- **Project**: Project root (id, name, path, version, packageManager, totalFiles, totalEntities, totalPackages, totalApplications)
- **Application**: Applications (id, name, path, version, main, types, applicationType, entryPointCount)
- **Package**: Packages (id, name, path, version, packageType, main, types)
- **Dependency**: Dependencies (id, name, version, dependencyType, isWorkspaceDependency, description, homepage)
- **ExternalModule**: External modules (id, name)
- **Module**: Modules (name, path, isExternal)

### Relationship Types:
**The Big 5 (Most Common):**
- **REFERENCES**: Property access, variable usage
- **CALLS**: Function/method calls
- **DECLARES**: Variable/function declarations
- **TYPE_OF**: Type references, generics
- **DEFINES**: Variable assignments, initializers

**Control Flow & Structure:**
- **RETURNS**: Return statements
- **AWAITS**: Async operations
- **IMPORTS**: Local imports
- **EXPORTS**: Export statements
- **CONTAINS**: Lexical containment (parent-child scopes)
- **BELONGS_TO**: Entity belongs to module

**Type System:**
- **CASTS_TO**: Type assertions
- **UNION_WITH**: Union types
- **EXTENDS**: Inheritance
- **IMPLEMENTS**: Interface implementation
- **INTERSECTS_WITH**: Intersection types

**Language Features:**
- **DESTRUCTURES**: Destructuring patterns
- **DECORATES**: Decorators
- **SPREADS**: Spread syntax
- **CATCHES**: Error handling
- **THROWS**: Exception throwing
- **BRANCHES_ON**: Conditional expressions

**External Dependencies:**
- **IMPORTS_EXTERNAL**: External module imports
- **DEPENDS_ON**: Package dependencies
- **USES_DEPENDENCY**: Code entity uses dependency
- **IMPORTS_FROM**: Import from dependency

**Project Hierarchy:**
- **HAS_APPLICATION**: Project has application
- **HAS_PACKAGE**: Project has package
- **HAS_ENTRYPOINT**: Application has entry point

### Common Query Patterns:
\`\`\`cypher
// Find all functions in a file
MATCH (f:CodeEntity {kind: "function", filePath: "src/app.ts"}) RETURN f;

// Find all calls to a specific function
MATCH (caller)-[:CALLS]->(f:CodeEntity {name: "myFunction"}) RETURN caller.name, caller.filePath;

// Find external dependencies
MATCH (p:Package)-[:DEPENDS_ON]->(d:Dependency) RETURN p.name, d.name, d.version;

// Find project structure
MATCH (proj:Project)-[:HAS_APPLICATION]->(app:Application)-[:HAS_ENTRYPOINT]->(file:SourceFile) 
RETURN proj.name, app.name, file.path;

// Find most-called functions
MATCH ()-[c:CALLS]->(f:CodeEntity) 
RETURN f.name, f.filePath, COUNT(c) as call_count 
ORDER BY call_count DESC;
\`\`\`
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
