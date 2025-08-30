import { tool } from "@lmstudio/sdk";
import { RustKuzuIngestor } from "@sage/graph";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const SCHEMA = `
## 🧠 Agent Onboarding Guide: Code Graph Database

### 🏗️ COMPLETE Graph Schema (Live Database - 7,450+ Nodes, 16 Relationship Types)

**🎯 Node Types (15 Total):**

**Code Entities (First-Class Citizens):**
- **Function** (858 nodes) - Properties: id, name, isAsync, isExported, returnType, parameters, filePath, line, columnNum, startPos, endPos, signature
- **Class** (61 nodes) - Properties: id, name, isAbstract, isExported, superClass, interfaces, filePath, line, columnNum, startPos, endPos, signature  
- **Interface** (50 nodes) - Properties: id, name, isExported, extends, properties, filePath, line, columnNum, startPos, endPos, signature
- **Variable** (4,578 nodes) - Properties: id, name, type, isConst, isExported, scope, defaultValue, filePath, line, columnNum, startPos, endPos, signature
- **Method** - Properties: id, name, isAsync, isStatic, visibility, returnType, parameters, className, filePath, line, columnNum, startPos, endPos, signature
- **Property** - Properties: id, name, type, isStatic, visibility, isReadonly, isOptional, defaultValue, className, filePath, line, columnNum, startPos, endPos, signature
- **TypeAlias** - Properties: id, name, isExported, definition, typeParameters, filePath, line, columnNum, startPos, endPos, signature
- **Enum** (300 nodes) - Properties: id, name, isConst, isExported, members, filePath, line, columnNum, startPos, endPos, signature

**Import/Export System:**
- **ImportAlias** (1,239 nodes) - Properties: id, localName, originalName, importPath, filePath, line, columnNum, startPos, endPos, signature
- **ExportAlias** - Properties: id, localName, originalName, exportType, isDefault, filePath, line, columnNum, startPos, endPos, signature
- **ExternalModule** - Properties: id, name

**Project Architecture:**
- **SourceFile** (343 nodes) - Properties: path, extension, isModule, size, totalLines, entityCount, relationshipCount
- **Project** - Properties: id, name, path, version, packageManager, totalFiles, totalEntities, totalPackages, totalApplications
- **Package** (11 nodes) - Properties: id, name, path, version, packageType, main, types
- **Application** (10 nodes) - Properties: id, name, path, version, main, types, applicationType, entryPointCount  
- **Dependency** - Properties: id, name, version, dependencyType, isWorkspaceDependency, description, homepage

### 🔗 Relationship Types (16 Total - ALL ACTIVE):

**Core Code Relationships:**
1. **CALLS** (635 edges) - Function/Method → Function/Method/ImportAlias invocations
2. **CONTAINS** - Hierarchical containment: SourceFile→{Function,Class,etc}, Class→{Method,Property}, Function→Variable  
3. **REFERENCES** - Variable/property references within code
4. **RESOLVES_TO** - ImportAlias → actual Function/Class/Interface/Variable/TypeAlias/Enum resolution

**Import/Export Flow:**
5. **IMPORTS** - SourceFile ↔ SourceFile, ImportAlias → SourceFile dependencies
6. **IMPORTS_EXTERNAL** - ImportAlias → ExternalModule (npm packages)
7. **EXPORTS** - SourceFile → {Function,Class,Interface,Variable,Enum,TypeAlias} public API
8. **USES_DEPENDENCY** - ImportAlias → Dependency (workspace dependencies)

**Object-Oriented Relationships:**
9. **EXTENDS** - Class → Class, Interface → Interface inheritance
10. **IMPLEMENTS** - Class → Interface implementation  
11. **INSTANCE_OF** - Variable/Property → Class (object instances)
12. **TYPE_OF** - Variable/Property → TypeAlias/Interface (type relationships)

**Project Architecture:**
13. **HAS_PACKAGE** - Project → Package (monorepo structure)
14. **HAS_APPLICATION** - Project → Application (apps/packages)
15. **HAS_ENTRYPOINT** - Application → SourceFile (main entry files)
16. **DEPENDS_ON** - Package → Dependency (package.json dependencies)

### 🚀 Agent Quick Start Queries:

\`\`\`cypher
// 🔍 Explore the codebase overview (7,450+ nodes)
MATCH (n) RETURN labels(n)[1] as node_type, count(*) as count ORDER BY count DESC;

// 🎯 Package dependency analysis 
MATCH (i:ImportAlias) WHERE i.importPath CONTAINS "@sage/"
WITH CASE 
  WHEN i.filePath CONTAINS "packages/graph" THEN "graph"
  WHEN i.filePath CONTAINS "packages/mcp" THEN "mcp" 
  ELSE "other"
END as fromPkg, 
CASE WHEN i.importPath CONTAINS "@sage/utils" THEN "utils" ELSE "other" END as toPkg
WHERE fromPkg <> "other" AND toPkg <> "other"
RETURN fromPkg, toPkg, count(*) as deps ORDER BY deps DESC;

// 📞 Function call graph analysis (635 call edges)
MATCH (f:Function)-[:CALLS]->(target:Function) 
RETURN f.name, target.name, f.filePath
LIMIT 10;

// 🏗️ File complexity analysis
MATCH (s:SourceFile) 
RETURN s.path, s.entityCount 
ORDER BY s.entityCount DESC LIMIT 10;

// 🔍 Find exported functions (public API)
MATCH (s:SourceFile)-[:EXPORTS]->(f:Function) 
WHERE s.path CONTAINS "packages/"
RETURN s.path, f.name ORDER BY s.path;

// 🌐 Import resolution patterns  
MATCH (alias:ImportAlias)-[:RESOLVES_TO]->(target) 
RETURN alias.localName, alias.importPath, labels(target)[1] as target_type, target.name 
LIMIT 10;

// 🏛️ Class structure analysis
MATCH (cls:Class)-[:CONTAINS]->(member) 
RETURN cls.name, labels(member)[1] as member_type, member.name;

// 📦 Cross-package function calls
MATCH (f:Function)-[:CALLS]->(target:Function)
WHERE f.filePath CONTAINS "packages/" AND target.filePath CONTAINS "packages/"
RETURN f.filePath, f.name, target.filePath, target.name LIMIT 10;

// 🔗 Most imported symbols from @sage/utils
MATCH (i:ImportAlias) WHERE i.importPath CONTAINS "@sage/utils"
RETURN i.localName, count(*) as usage_count 
ORDER BY usage_count DESC LIMIT 10;
\`\`\`

### 💡 Agent Tips for Code Analysis:

**🎯 Node Access Patterns:**
- Use \`labels(n)[1]\` to get primary node type (avoids array output)
- Node counts: Variables(4,578), ImportAlias(1,239), Functions(858), SourceFiles(343), Enums(300)
- Rich location data: all code entities have filePath, line, columnNum, startPos, endPos

**📞 Call Graph Analysis (635 active edges):**
- Function→Function, Method→Function, Method→Method all supported
- Cross-package calls tracked via filePath analysis
- ImportAlias calls show external dependencies

**🔗 Import/Export Flow:**
- ImportAlias.importPath shows "@sage/package" patterns for monorepo dependencies
- RESOLVES_TO connects imports to actual definitions
- USES_DEPENDENCY links to package.json dependencies

**🏗️ Package Architecture:**
- 11 packages with dependency flows: utils←{chronicle:8, mcp:7, graph:5}
- Cross-package analysis via filePath pattern matching
- Package I/O density shows architectural coupling

**🔍 Query Performance Tips:**
- Use specific labels: \`:Function\` not generic filtering
- filePath CONTAINS "packages/xyz" for package-scoped queries
- LIMIT for large result sets (Variables table has 4K+ entries)
- labels(n)[1] faster than labels(n) for single type

**⚠️ Schema Architecture Notes:**
- All 16 relationship types are active and populated
- SourceFile is the containment root for all code entities
- ImportAlias is the bridge between internal and external dependencies
- Method/Property belong to Classes, Variables can belong to Functions
- Rich metadata: signatures, types, visibility, async flags all captured
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
