import { tool } from "@lmstudio/sdk";
import { z } from "zod";
import { RustKuzuIngestor } from "@sage/analysis";
import { join } from "path";
import { existsSync } from "fs";

const SCHEMA_INFO = `
GRAPH SCHEMA:

Node Types:
- CodeEntity: Represents all code elements (functions, classes, variables, etc.)
  Properties: id, kind, name, text, filePath, lineNum, colNum, startPos, endPos, nodeFlags
- SourceFile: Represents source code files
  Properties: path, extension, size, totalLines, entityCount, relationshipCount
- Module: Represents modules/packages
  Properties: name, path, isExternal

Relationship Types:
- CALLS: Function/method calls 
- REFERENCES: Property access, variable usage 
- DECLARES: Variable/function/type declarations 
- TYPE_OF: Type references, generics 
- DEFINES: Variable assignments, initializers

Additional Relationships:
- RETURNS, AWAITS, IMPORTS, EXPORTS (control flow)
- CASTS_TO, UNION_WITH, EXTENDS, IMPLEMENTS, INTERSECTS_WITH (type system)
- DESTRUCTURES, DECORATES, SPREADS, CATCHES, THROWS, BRANCHES_ON (language features)
- CONTAINS: SourceFile contains CodeEntity
- BELONGS_TO: CodeEntity belongs to Module

`;

const TIPS = `
KUZU QUERY TIPS:

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
  description: `Execute custom Cypher queries against the project code graph.

${SCHEMA_INFO}

${TIPS}`,
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
    const dbPath = join(process.cwd(), '.sage', 'code.kuzu');
    
    // Check if the database exists
    if (!existsSync(dbPath)) {
      return {
        error: "No code graph database found. Run 'sage ingest' first to analyze your codebase."
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
