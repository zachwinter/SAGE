import { createTempWorkspace, type TempWorkspace } from "@sage/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { getDatabaseStatus, ingestProject, queryGraph } from "./index.js";

describe("@sage/graph - Core API", () => {
  let workspace: TempWorkspace;
  const testCommitHash = "abc123def456";

  beforeEach(async () => {
    // Create isolated test workspace
    workspace = await createTempWorkspace({ prefix: "sage-graph-test-" });

    // Create simple TypeScript file for testing
    await workspace.file(
      "src/index.ts",
      `// Test TypeScript file
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export class User {
  constructor(private name: string) {}
  
  getName(): string {
    return this.name;
  }
}

const admin = new User('Admin');
console.log(greet(admin.getName()));
`
    );

    // Create package.json
    await workspace.file(
      "package.json",
      JSON.stringify(
        {
          name: "test-project",
          version: "1.0.0",
          type: "module"
        },
        null,
        2
      )
    );
  });

  it("should get database status for non-existent database", async () => {
    const status = await getDatabaseStatus(workspace.root);

    expect(status.exists).toBe(false);
    expect(status.path).toContain("kuzu_db");
  });

  // Note: Actual ingestion test requires the kuzu-rust binary and analysis pipeline
  // This is more of an integration test that would need the full environment
  it.skip("should ingest a project and create database", async () => {
    // This test is skipped because it requires:
    // 1. kuzu-rust binary to be available
    // 2. @sage/graph package to be built
    // 3. Full TypeScript AST analysis pipeline

    await ingestProject({
      projectPath: workspace.root,
      commitHash: testCommitHash
    });

    const status = await getDatabaseStatus(workspace.root);
    expect(status.exists).toBe(true);
  });

  it.skip("should execute queries against database", async () => {
    // This test is skipped because it requires an existing database

    const result = await queryGraph({
      query: "MATCH (f:Function) WHERE f.name = $name RETURN f.name, f.signature",
      params: { name: "greet" }
    });

    expect(result.error).toBeUndefined();
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it.skip("should support historical queries with commit parameter", async () => {
    // This test is skipped because it requires git integration and historical data

    const result = await queryGraph({
      query: "MATCH (n) RETURN count(n) as total",
      commit: "previous-commit-hash"
    });

    expect(result.error).toBeUndefined();
    expect(result.meta?.commit).toBe("previous-commit-hash");
  });

  // Unit tests for individual components can be added here
  it("should export all required types", () => {
    // This is a simple test to ensure all exports are available
    expect(ingestProject).toBeDefined();
    expect(queryGraph).toBeDefined();
    expect(getDatabaseStatus).toBeDefined();
  });
});
