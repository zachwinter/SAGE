import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { KuzuGraphIngestor } from "../ingest.js";
import { GraphQueryEngine, queryCode, AGENT_QUERIES, runAgentQuery } from "../query.js";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync, writeFileSync } from "fs";
import { analyzeFiles } from "../../engine/analyzer.js";

describe("GraphQueryEngine and queryCode", () => {
  let ingestor: KuzuGraphIngestor;
  let testDbPath: string;
  let testProjectPath: string;

  beforeAll(async () => {
    testDbPath = join(tmpdir(), `kuzu-query-db-${Date.now()}`);
    ingestor = new KuzuGraphIngestor(testDbPath);
    await ingestor.initialize();
  });

  afterAll(async () => {
    await ingestor.close();
    try {
      rmSync(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    await ingestor.query("MATCH (n) DETACH DELETE n;");

    // Setup a temporary project directory for analysis
    testProjectPath = join(tmpdir(), `query-test-project-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });

    // Ingest a simple project for querying
    const mainJsContent = `
      function calculateSum(a, b) {
        return a + b;
      }
      function multiply(a, b) {
        return a * b;
      }
      calculateSum(1, 2);
      multiply(3, 4);
    `;
    writeFileSync(join(testProjectPath, "main.js"), mainJsContent);

    const analysisResults = analyzeFiles([join(testProjectPath, "main.js")]);
    await ingestor.ingest(analysisResults);
  });

  afterEach(() => {
    // Cleanup temporary project directory
    try {
      rmSync(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("GraphQueryEngine should execute queries and return results", async () => {
    const engine = new GraphQueryEngine(testProjectPath);
    const result = await engine.query("MATCH (n:CodeEntity) RETURN count(n) as total");
    expect(result.rows).toBeDefined();
    expect(result.rows[0].total).toBeGreaterThan(0);
  });

  it("queryCode should execute queries and return results", async () => {
    const result = await queryCode("MATCH (n:CodeEntity) RETURN count(n) as total", testProjectPath);
    expect(result.rows).toBeDefined();
    expect(result.rows[0].total).toBeGreaterThan(0);
  });

  it("runAgentQuery should execute predefined queries", async () => {
    const result = await runAgentQuery("fileWriters", testProjectPath);
    expect(result.rows).toBeDefined();
    // Depending on the fixture, you might expect 0 or more results
    // For this simple fixture, we expect 0 file writers
    expect(result.rows).toHaveLength(0);
  });

  it("runAgentQuery should throw error for unknown query", async () => {
    await expect(runAgentQuery("unknownQuery" as any, testProjectPath)).rejects.toThrow("Unknown query");
  });

  // Add more specific tests for AGENT_QUERIES here, using more complex fixtures
});
