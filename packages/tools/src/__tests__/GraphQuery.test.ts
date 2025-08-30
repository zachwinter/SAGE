import { describe, it, expect, beforeEach, vi } from "vitest";
import { GraphQuery } from "../GraphQuery.js";

// Mock dependencies
vi.mock("@sage/graph", () => ({
  RustKuzuIngestor: vi.fn()
}));

vi.mock("fs", () => ({
  existsSync: vi.fn()
}));

vi.mock("path", () => ({
  join: vi.fn((...segments) => segments.join("/"))
}));

// Mock process.cwd for consistent testing
vi.mock("process", () => ({
  cwd: vi.fn(() => "/test/workspace")
}));

describe("GraphQuery Tool", () => {
  let mockIngestor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockIngestor = {
      query: vi.fn()
    };
    
    // Correct way to mock the constructor
    const mockRustKuzuIngestor = vi.fn(() => mockIngestor);
    vi.mocked(require("@sage/graph")).RustKuzuIngestor = mockRustKuzuIngestor;
  });

  describe("tool structure", () => {
    it("should have correct name and description", () => {
      expect(GraphQuery.name).toBe("GraphQuery");
      expect(GraphQuery.description).toContain("Execute custom Cypher queries");
      expect(GraphQuery.description).toContain("Graph Schema Overview");
    });
  });

  describe("database existence check", () => {
    it("should return error when database does not exist", async () => {
      const mockExistsSync = vi.fn(() => false);
      vi.mocked(require("fs")).existsSync = mockExistsSync;

      const result = await GraphQuery.implementation({
        query: "MATCH (n) RETURN n",
        limit: 50
      });

      expect(result).toEqual({
        error: "No code graph database found. Run 'sage ingest' first to analyze your codebase."
      });
      expect(mockExistsSync).toHaveBeenCalledWith("/test/workspace/.sage/code.kuzu");
    });
  });

  describe("query execution", () => {
    beforeEach(() => {
      const mockExistsSync = vi.fn(() => true);
      vi.mocked(require("fs")).existsSync = mockExistsSync;
    });

    it("should execute query successfully", async () => {
      const mockResults = [
        { id: "node1", type: "Function", name: "test" },
        { id: "node2", type: "Class", name: "TestClass" }
      ];
      mockIngestor.query.mockResolvedValue(mockResults);

      const result = await GraphQuery.implementation({
        query: "MATCH (n:Function) RETURN n",
        limit: 50
      });

      expect(result).toEqual({
        success: true,
        results: mockResults,
        query: "MATCH (n:Function) RETURN n"
      });
    });

    it("should create RustKuzuIngestor with correct database path", async () => {
      const mockRustKuzuIngestor = vi.fn(() => mockIngestor);
      vi.mocked(require("@sage/graph")).RustKuzuIngestor = mockRustKuzuIngestor;
      mockIngestor.query.mockResolvedValue([]);

      await GraphQuery.implementation({
        query: "MATCH (n) RETURN n",
        limit: 50
      });

      expect(mockRustKuzuIngestor).toHaveBeenCalledWith("/test/workspace/.sage/code.kuzu");
    });

    it("should pass query to ingestor", async () => {
      const query = "MATCH (f:Function)-[:CALLS]->(c:Function) RETURN f.name, c.name";
      mockIngestor.query.mockResolvedValue([]);

      await GraphQuery.implementation({ query, limit: 50 });

      expect(mockIngestor.query).toHaveBeenCalledWith(query);
    });

    it("should handle complex queries with relationships", async () => {
      const complexQuery = `
        MATCH (f:Function)-[:CONTAINS]->(v:Variable)
        WHERE f.name = 'targetFunction'
        RETURN f.name as function, collect(v.name) as variables
      `;
      const mockResults = [{
        function: "targetFunction",
        variables: ["param1", "localVar", "result"]
      }];
      mockIngestor.query.mockResolvedValue(mockResults);

      const result = await GraphQuery.implementation({
        query: complexQuery,
        limit: 50
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockResults);
    });

    it("should handle empty results", async () => {
      mockIngestor.query.mockResolvedValue([]);

      const result = await GraphQuery.implementation({
        query: "MATCH (n:NonExistentType) RETURN n",
        limit: 50
      });

      expect(result).toEqual({
        success: true,
        results: [],
        query: "MATCH (n:NonExistentType) RETURN n"
      });
    });
  });

  describe("limit handling", () => {
    beforeEach(() => {
      const mockExistsSync = vi.fn(() => true);
      vi.mocked(require("fs")).existsSync = mockExistsSync;
      mockIngestor.query.mockResolvedValue([]);
    });

    it("should add LIMIT when not present in query", async () => {
      const query = "MATCH (n) RETURN n";
      
      await GraphQuery.implementation({ query, limit: 25 });

      expect(mockIngestor.query).toHaveBeenCalledWith("MATCH (n) RETURN n LIMIT 25");
    });

    it("should not add LIMIT when already present (case insensitive)", async () => {
      const query = "MATCH (n) RETURN n LIMIT 10";
      
      await GraphQuery.implementation({ query, limit: 25 });

      expect(mockIngestor.query).toHaveBeenCalledWith(query);
    });

    it("should detect LIMIT in different cases", async () => {
      const queries = [
        "MATCH (n) RETURN n limit 5",
        "MATCH (n) RETURN n Limit 5",
        "MATCH (n) RETURN n LIMIT 5"
      ];

      for (const query of queries) {
        mockIngestor.query.mockClear();
        await GraphQuery.implementation({ query, limit: 25 });
        expect(mockIngestor.query).toHaveBeenCalledWith(query);
      }
    });

    it("should use default limit when not specified", async () => {
      const query = "MATCH (n) RETURN n";
      
      await GraphQuery.implementation({ query, limit: 50 });

      expect(mockIngestor.query).toHaveBeenCalledWith("MATCH (n) RETURN n LIMIT 50");
    });

    it("should not add LIMIT when limit is falsy", async () => {
      const query = "MATCH (n) RETURN n";
      
      await GraphQuery.implementation({ query, limit: 0 });

      expect(mockIngestor.query).toHaveBeenCalledWith(query);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      const mockExistsSync = vi.fn(() => true);
      vi.mocked(require("fs")).existsSync = mockExistsSync;
    });

    it("should handle query execution errors", async () => {
      const error = new Error("Cypher syntax error");
      mockIngestor.query.mockRejectedValue(error);

      const query = "INVALID CYPHER QUERY";
      const result = await GraphQuery.implementation({ query, limit: 50 });

      expect(result).toEqual({
        success: false,
        error: "Cypher syntax error",
        query: query
      });
    });

    it("should handle database connection errors", async () => {
      const mockRustKuzuIngestor = vi.fn(() => {
        throw new Error("Failed to connect to database");
      });
      vi.mocked(require("@sage/graph")).RustKuzuIngestor = mockRustKuzuIngestor;

      const result = await GraphQuery.implementation({
        query: "MATCH (n) RETURN n",
        limit: 50
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to connect to database");
    });

    it("should handle non-Error exceptions", async () => {
      mockIngestor.query.mockRejectedValue("String error message");

      const result = await GraphQuery.implementation({
        query: "MATCH (n) RETURN n",
        limit: 50
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error message");
    });

    it("should preserve original query in error response", async () => {
      const originalQuery = "MATCH (n:Function) RETURN n.name";
      mockIngestor.query.mockRejectedValue(new Error("Query failed"));

      const result = await GraphQuery.implementation({
        query: originalQuery,
        limit: 10
      });

      expect(result.query).toBe(originalQuery);
    });

    it("should return modified query in success response", async () => {
      const originalQuery = "MATCH (n) RETURN n";
      mockIngestor.query.mockResolvedValue([]);

      const result = await GraphQuery.implementation({
        query: originalQuery,
        limit: 25
      });

      expect(result.query).toBe("MATCH (n) RETURN n LIMIT 25");
    });
  });

  describe("schema documentation", () => {
    it("should contain comprehensive schema information", () => {
      expect(GraphQuery.description).toContain("Node Types");
      expect(GraphQuery.description).toContain("Function");
      expect(GraphQuery.description).toContain("Class");
      expect(GraphQuery.description).toContain("Method");
      expect(GraphQuery.description).toContain("CALLS");
      expect(GraphQuery.description).toContain("CONTAINS");
      expect(GraphQuery.description).toContain("REFERENCES");
    });

    it("should contain example queries", () => {
      expect(GraphQuery.description).toContain("Quick Start Queries");
      expect(GraphQuery.description).toContain("MATCH (n) RETURN labels(n)");
      expect(GraphQuery.description).toContain("MATCH (fn:Function)");
    });

    it("should contain performance tips", () => {
      expect(GraphQuery.description).toContain("Performance Tips");
      expect(GraphQuery.description).toContain("Use specific labels");
    });
  });

  describe("real-world query scenarios", () => {
    beforeEach(() => {
      const mockExistsSync = vi.fn(() => true);
      vi.mocked(require("fs")).existsSync = mockExistsSync;
    });

    it("should handle function dependency queries", async () => {
      const mockResults = [
        { caller: "main", callee: "helper1" },
        { caller: "helper1", callee: "helper2" }
      ];
      mockIngestor.query.mockResolvedValue(mockResults);

      const result = await GraphQuery.implementation({
        query: "MATCH (f1:Function)-[:CALLS]->(f2:Function) RETURN f1.name as caller, f2.name as callee",
        limit: 50
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockResults);
    });

    it("should handle class hierarchy queries", async () => {
      const mockResults = [
        { class: "BaseClass", member: "Method", name: "process" },
        { class: "BaseClass", member: "Property", name: "data" }
      ];
      mockIngestor.query.mockResolvedValue(mockResults);

      const result = await GraphQuery.implementation({
        query: "MATCH (c:Class)-[:CONTAINS]->(m) RETURN c.name as class, labels(m)[0] as member, m.name as name",
        limit: 50
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockResults);
    });

    it("should handle import resolution queries", async () => {
      const mockResults = [
        { alias: "React", importPath: "react", target: "ExternalModule" },
        { alias: "useState", importPath: "react", target: "Function" }
      ];
      mockIngestor.query.mockResolvedValue(mockResults);

      const result = await GraphQuery.implementation({
        query: "MATCH (i:ImportAlias)-[:RESOLVES_TO]->(t) RETURN i.localName as alias, i.importPath, labels(t)[0] as target",
        limit: 50
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockResults);
    });
  });
});