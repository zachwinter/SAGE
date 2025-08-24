import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { KuzuGraphIngestor } from "../ingest.js";
import { analyzeFiles } from "../../engine/analyzer.js";
import { join } from "path";
import { tmpdir } from "os";
import { mkdirSync, writeFileSync, rmSync } from "fs";

describe("Graph Ingestion Integration", () => {
  let ingestor: KuzuGraphIngestor;
  let testDbPath: string;
  let testProjectPath: string;

  beforeAll(async () => {
    // Setup Kuzu database
    testDbPath = join(tmpdir(), `kuzu-integration-db-${Date.now()}`);
    ingestor = new KuzuGraphIngestor(testDbPath);
    await ingestor.initialize();
  });

  afterAll(async () => {
    // Cleanup Kuzu database
    await ingestor.close();
    try {
      rmSync(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear database before each test
    await ingestor.query("MATCH (n) DETACH DELETE n;");

    // Setup a temporary project directory for analysis
    testProjectPath = join(tmpdir(), `test-project-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
  });

  afterEach(() => {
    // Cleanup temporary project directory
    try {
      rmSync(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should ingest a simple JavaScript project and verify its graph structure", async () => {
    // Create a simple project fixture
    const mainJsContent = `
      function greet(name) {
        return "Hello, " + name;
      }
      function sayHello() {
        console.log(greet("World"));
      }
      sayHello();
    `;
    writeFileSync(join(testProjectPath, "main.js"), mainJsContent);

    // Analyze the project
    const analysisResults = analyzeFiles([join(testProjectPath, "main.js")]);
    expect(analysisResults).toHaveLength(1);

    // Ingest into Kuzu
    await ingestor.ingest(analysisResults);

    // Verify graph structure using Cypher queries
    const nodesCount = await ingestor.query("MATCH (n) RETURN count(n) as count");
    expect(nodesCount[0].count).toBeGreaterThan(0);

    const functions = await ingestor.query("MATCH (n:CodeEntity {kind: 'function'}) RETURN n.name as name");
    expect(functions.map(f => f.name)).toEqual(expect.arrayContaining(["greet", "sayHello"]));

    const calls = await ingestor.query("MATCH (c:CodeEntity)-[r:CALLS]->(t:CodeEntity) RETURN c.name as caller, t.name as callee");
    expect(calls).toEqual(expect.arrayContaining([
      { caller: "sayHello", callee: "greet" }
    ]));
  });

  it("should ingest a project with multiple files and verify relationships across files", async () => {
    // Create multi-file project fixture
    const utilsJsContent = `
      export function add(a, b) { return a + b; }
    `;
    const appJsContent = `
      import { add } from './utils.js';
      function calculate() {
        console.log(add(1, 2));
      }
      calculate();
    `;
    writeFileSync(join(testProjectPath, "utils.js"), utilsJsContent);
    writeFileSync(join(testProjectPath, "app.js"), appJsContent);

    // Analyze the project
    const analysisResults = analyzeFiles([
      join(testProjectPath, "utils.js"),
      join(testProjectPath, "app.js")
    ]);
    expect(analysisResults).toHaveLength(2);

    // Ingest into Kuzu
    await ingestor.ingest(analysisResults);

    // Verify import relationship
    const imports = await ingestor.query("MATCH (f:SourceFile)-[r:IMPORTS]->(t:SourceFile) RETURN f.path as importer, t.path as imported");
    expect(imports).toEqual(expect.arrayContaining([
      { importer: expect.stringContaining("app.js"), imported: expect.stringContaining("utils.js") }
    ]));

    // Verify call relationship across files
    const calls = await ingestor.query("MATCH (c:CodeEntity)-[r:CALLS]->(t:CodeEntity) RETURN c.name as caller, t.name as callee");
    expect(calls).toEqual(expect.arrayContaining([
      { caller: "calculate", callee: "add" }
    ]));
  });

  it("should handle projects with no entities or calls gracefully", async () => {
    const emptyJsContent = `// This is an empty file`;
    writeFileSync(join(testProjectPath, "empty.js"), emptyJsContent);

    const analysisResults = analyzeFiles([join(testProjectPath, "empty.js")]);
    expect(analysisResults).toHaveLength(1);

    await ingestor.ingest(analysisResults);

    const nodesCount = await ingestor.query("MATCH (n) RETURN count(n) as count");
    expect(nodesCount[0].count).toBe(1); // Only SourceFile node
  });

  // Add more complex scenarios as needed, e.g., classes, types, exports, etc.
});
