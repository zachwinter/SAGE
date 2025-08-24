import { KuzuGraphIngestor } from "./ingest.js";
import { resolve } from "path";
import { tmpdir } from "os";

export interface QueryResult {
  rows: any[];
  executionTime: number;
  totalTime: number;
}

export class GraphQueryEngine {
  private ingestor: KuzuGraphIngestor;
  private dbPath: string;
  private isInitialized = false;

  constructor(projectPath?: string) {
    this.dbPath = resolve(tmpdir(), `kuzu-${Date.now()}.db`);
    this.ingestor = new KuzuGraphIngestor(this.dbPath);
  }

  async ensureReady(projectPath: string = process.cwd()) {
    if (this.isInitialized) return;
    // const startTime = performance.now();
    await this.ingestor.initialize();
    await this.ingestor.ingestProject(projectPath);
    // const totalTime = performance.now() - startTime;
    this.isInitialized = true;
  }

  async query(cypher: string, projectPath?: string): Promise<QueryResult> {
    if (projectPath) {
      this.isInitialized = false;
      await this.ensureReady(projectPath);
    } else {
      await this.ensureReady();
    }

    const startTime = performance.now();
    const rows = await this.ingestor.query(cypher);
    const executionTime = performance.now() - startTime;

    return {
      rows,
      executionTime,
      totalTime: executionTime
    };
  }
}

export async function queryCode(
  cypher: string,
  projectPath?: string
): Promise<QueryResult> {
  const engine = new GraphQueryEngine();
  try {
    return await engine.query(cypher, projectPath);
  } finally {
    // aight
  }
}

// Predefined badass queries for agents
export const AGENT_QUERIES = {
  // Find all functions that write to files
  fileWriters: `
    MATCH (fn:CodeEntity)-[:CALLS*1..]->(writer:CodeEntity)
    WHERE writer.name =~ '.*write.*File.*|.*writeFile.*'
    RETURN DISTINCT fn.name, fn.filePath, fn.lineNum
    ORDER BY fn.filePath
  `,

  // Find security-sensitive functions (file system, network, process)
  securitySensitive: `
    MATCH (fn:CodeEntity)-[:CALLS*1..]->(dangerous:CodeEntity)
    WHERE dangerous.name =~ '.*(exec|spawn|eval|writeFile|readFile|request|fetch|require).*'
    RETURN fn.name, fn.filePath, dangerous.name as calls, fn.lineNum
    ORDER BY fn.filePath
  `,

  // Find all React components and their props
  reactComponents: `
    MATCH (component:CodeEntity)
    WHERE component.kind = 'function' AND component.text =~ '.*React.*|.*JSX.*|.*tsx.*'
    RETURN component.name, component.filePath, component.text, component.lineNum
    ORDER BY component.name
  `,

  // Find circular dependencies in function calls
  circularCalls: `
    MATCH path = (a:CodeEntity)-[:CALLS*2..]->(a)
    WHERE a.kind = 'function'
    RETURN DISTINCT a.name, a.filePath, length(path) as depth
    ORDER BY depth DESC
  `,

  // Find all functions that handle errors
  errorHandlers: `
    MATCH (fn:CodeEntity)
    WHERE fn.text =~ '.*(catch|error|Error|throw|reject).*'
    RETURN fn.name, fn.filePath, fn.text, fn.lineNum
    ORDER BY fn.filePath
  `,

  // Find API endpoints and their handlers
  apiEndpoints: `
    MATCH (endpoint:CodeEntity)
    WHERE endpoint.text =~ '.*(get|post|put|delete|patch)\\s*\\(' 
       OR endpoint.text =~ '.*app\\.(get|post|put|delete|patch).*'
    RETURN endpoint.name, endpoint.filePath, endpoint.text, endpoint.lineNum
    ORDER BY endpoint.filePath
  `,

  // Find database queries and connections
  databaseOps: `
    MATCH (fn:CodeEntity)-[:CALLS*1..]->(db:CodeEntity)
    WHERE db.name =~ '.*(query|execute|find|save|delete|update|insert|select).*'
       OR db.name =~ '.*(db|database|sql|mongo|postgres|mysql).*'
    RETURN DISTINCT fn.name, fn.filePath, db.name as dbOp, fn.lineNum
    ORDER BY fn.filePath
  `,

  // Find all exported functions (public API surface)
  publicApi: `
    MATCH (fn:CodeEntity)
    WHERE fn.text =~ '.*export.*'
    RETURN fn.name, fn.filePath, fn.kind, fn.lineNum
    ORDER BY fn.filePath, fn.lineNum
  `,

  // Find test files and their test cases
  testCases: `
    MATCH (test:CodeEntity)
    WHERE test.filePath =~ '.*(test|spec)\\.(js|ts|tsx).*'
       OR test.name =~ '.*(test|spec|describe|it).*'
    RETURN test.name, test.filePath, test.kind, test.lineNum
    ORDER BY test.filePath
  `,

  // Find most connected functions (high coupling)
  mostConnected: `
    MATCH (fn:CodeEntity)-[r]->(connected)
    WHERE fn.kind = 'function'
    RETURN fn.name, fn.filePath, count(r) as connections
    ORDER BY connections DESC
    LIMIT 20
  `
};

export async function runAgentQuery(
  queryName: keyof typeof AGENT_QUERIES,
  projectPath?: string
) {
  const cypher = AGENT_QUERIES[queryName];
  if (!cypher) throw new Error(`Unknown query: ${queryName}`);

  return await queryCode(cypher, projectPath);
}
