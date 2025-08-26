import { tool } from "@lmstudio/sdk";
import { RustKuzuIngestor } from "@sage/analysis";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const TIPS = `
NODES:

CodeEntity (id: 0)
    - Properties: id, kind, name, text, filePath, lineNum, colNum, startPos, endPos, nodeFlags

SourceFile (id: 1)
    - Properties: path, extension, size, totalLines, entityCount, relationshipCount

Module (id: 2)
    - Properties: name, path, isExternal

Project (id: 3)
    - Properties: id, name, path, version, packageManager, totalFiles, totalEntities, totalPackages, totalApplications

Application (id: 4)
    - Properties: id, name, path, version, main, types, applicationType, entryPointCount

Package (id: 5)
    - Properties: id, name, path, version, packageType, main, types

Dependency (id: 6)
    - Properties: id, name, version, dependencyType, isWorkspaceDependency, description, homepage

RELATIONSHIPS:

REFERENCES (id: 8)
CALLS (id: 10)
DECLARES (id: 12)
TYPE_OF (id: 14)
DEFINES (id: 16)
RETURNS (id: 18)
AWAITS (id: 20)
IMPORTS (id: 22)
EXPORTS (id: 24)
CASTS_TO (id: 26)
UNION_WITH (id: 28)
EXTENDS (id: 30)
IMPLEMENTS (id: 32)
INTERSECTS_WITH (id: 34)
DESTRUCTURES (id: 36)
DECORATES (id: 38)
SPREADS (id: 40)
CATCHES (id: 42)
THROWS (id: 44)
BRANCHES_ON (id: 46)
CONTAINS (id: 48)
BELONGS_TO (id: 50)
HAS_APPLICATION (id: 52)
HAS_PACKAGE (id: 54)
HAS_ENTRYPOINT (id: 56)
DEPENDS_ON (id: 58)
USES_DEPENDENCY (id: 60)

TIPS:

1. Always specify node/relationship labels: MATCH (n:CodeEntity) not MATCH (n)
2. Use RETURN COUNT(*) instead of FINISH for single record returns
3. Use UNWIND instead of FOREACH
4. Relationships cannot be omitted: use -[]-> not -->
5. Variable length relationships need upper bounds: -[*1..10]-> not -[*]->
6. For shortest paths: -[* SHORTEST 1..10]->
7. Use SET n.prop = NULL instead of REMOVE
8. No WHERE inside patterns: MATCH (n:CodeEntity) WHERE n.name = 'foo' RETURN n
9. Use CALL show_functions() RETURN * instead of SHOW FUNCTIONS
10. Kuzu uses walk semantics (allows repeated edges) by default
`;
export const GraphQuery = tool({
  name: "GraphQuery",
  description: `Execute custom Cypher queries against the project code graph.\n\n${TIPS}`,
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
