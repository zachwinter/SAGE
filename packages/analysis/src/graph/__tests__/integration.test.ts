import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";
import { analyzeToGraph } from "../../engine/graph-analyzer.js";
import { RustKuzuIngestor } from "../rust-ingestor.js";

describe("Graph Ingestion Integration", () => {
  let ingestor: RustKuzuIngestor;
  let testDbPath: string;
  let testProjectPath: string;

  beforeAll(async () => {
    // Setup Kuzu database using Rust binary
    testDbPath = join(tmpdir(), `rust-kuzu-integration-db-${Date.now()}`);
    ingestor = new RustKuzuIngestor(testDbPath);
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

    // Analyze to graph-native format (superior format!)
    const analysisData = analyzeToGraph([join(testProjectPath, "main.js")]);
    expect(analysisData.entities.length).toBeGreaterThan(0);
    expect(analysisData.relationships.length).toBeGreaterThan(0);

    // Ingest using Rust binary (zero-conversion!)
    const ingestResult = await ingestor.ingest(analysisData);
    expect(ingestResult.entities).toBeGreaterThan(0);

    // Verify graph structure using Cypher queries
    const nodesCount = await ingestor.query("MATCH (n) RETURN count(n) as count");
    expect(nodesCount[0].count).toBeGreaterThan(0);

    const functions = await ingestor.query(
      "MATCH (n:CodeEntity {kind: 'function'}) RETURN n.name as name"
    );
    expect(functions.map(f => f.name)).toEqual(
      expect.arrayContaining(["greet", "sayHello"])
    );

    const calls = await ingestor.query(
      "MATCH (c:CodeEntity)-[r:CALLS]->(t:CodeEntity) RETURN c.name as caller, t.name as callee"
    );
    expect(calls).toEqual(
      expect.arrayContaining([{ caller: "sayHello", callee: "greet" }])
    );
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

    // Analyze to graph-native format
    const analysisData = analyzeToGraph([
      join(testProjectPath, "utils.js"),
      join(testProjectPath, "app.js")
    ]);
    expect(analysisData.entities.length).toBeGreaterThan(0);

    // Ingest using Rust binary
    const ingestResult = await ingestor.ingest(analysisData);
    expect(ingestResult.entities).toBeGreaterThan(0);

    // Note: Import relationships are temporarily disabled in the new graph model
    // We'll re-implement them as part of the module I/O enhancement

    // Verify call relationship across files
    const calls = await ingestor.query(
      "MATCH (c:CodeEntity)-[r:CALLS]->(t:CodeEntity) RETURN c.name as caller, t.name as callee"
    );
    expect(calls).toEqual(
      expect.arrayContaining([{ caller: "calculate", callee: "add" }])
    );
  });
});
