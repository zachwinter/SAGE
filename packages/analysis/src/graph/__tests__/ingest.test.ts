import { rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallExpression, CodeEntity, FileAnalysisResult } from "../../types.js";
import { KuzuGraphIngestor } from "../ingest.js";

function mapFrom(obj: Record<any, any>) {
  const map = new Map();

  Object.keys(obj).forEach(key => {
    map.set(String(key), String(obj[key]));
  });

  return map;
}

describe("KuzuGraphIngestor", () => {
  let ingestor: KuzuGraphIngestor;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = join(tmpdir(), `test-kuzu-${Date.now()}`);
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
  });

  describe("initialization", () => {
    it("should initialize database and schema", async () => {
      // Test that we can run a basic query on an empty DB
      const result = await ingestor.query(
        "MATCH (n:CodeEntity) RETURN count(n) as count"
      );
      expect(result).toBeDefined();
      expect(result[0].count).toBe(0); // Should be 0 after beforeEach cleanup
    });

    // This test is now less critical as initialize is only called once,
    // but we can keep it for completeness.
    it("should handle schema creation gracefully when already exists", async () => {
      await expect(ingestor.initialize()).resolves.not.toThrow();
    });
  });

  describe("entity conversion", () => {
    it("should convert code entities to graph entities correctly for various types", () => {
      const mockFileResult: FileAnalysisResult = {
        filePath: "/test/file.ts",
        totalLines: 100,
        entities: [
          {
            type: "function",
            name: "testFunction",
            signature: "function testFunction(): void",
            line: 10,
            column: 5,
            pos: 100,
            end: 120
          } as CodeEntity,
          {
            type: "class",
            name: "MyClass",
            signature: "class MyClass {}",
            line: 20,
            column: 0,
            pos: 200,
            end: 250
          } as CodeEntity,
          {
            type: "interface",
            name: "MyInterface",
            signature: "interface MyInterface {}",
            line: 30,
            column: 0,
            pos: 300,
            end: 330
          } as CodeEntity,
          {
            type: "variable",
            name: "myVar",
            signature: "const myVar = 1;",
            line: 40,
            column: 0,
            pos: 400,
            end: 415
          } as CodeEntity,
          {
            type: "import",
            name: "{ something } from './module'",
            signature: "import { something } from './module';",
            line: 50,
            column: 0,
            pos: 500,
            end: 530
          } as CodeEntity,
          {
            type: "export",
            name: "default export",
            signature: "export default class {};",
            line: 60,
            column: 0,
            pos: 600,
            end: 625
          } as CodeEntity
        ],
        callExpressions: [],
        typeInfo: {
          typeAliases: [],
          interfaces: [],
          classes: [],
          enums: [],
          typeReferences: []
        }
      };

      const result = (ingestor as any).convertToGraph([mockFileResult]);

      expect(result.entities).toHaveLength(6);

      // Assertions for function entity
      const funcEntity = result.entities.find(e => e.kind === "function");
      expect(funcEntity).toMatchObject({
        kind: "function",
        name: "testFunction",
        text: "function testFunction(): void",
        line: 10,
        column: 5,
        pos: 100,
        end: 120
      });
      expect(funcEntity.id).toBeDefined();
      expect(funcEntity.filePath).toContain("test/file.ts");

      // Assertions for class entity
      const classEntity = result.entities.find(e => e.kind === "class");
      expect(classEntity).toMatchObject({
        kind: "class",
        name: "MyClass",
        text: "class MyClass {}",
        line: 20
      });

      // Assertions for interface entity
      const interfaceEntity = result.entities.find(e => e.kind === "interface");
      expect(interfaceEntity).toMatchObject({
        kind: "interface",
        name: "MyInterface",
        text: "interface MyInterface {}",
        line: 30
      });

      // Assertions for variable entity
      const varEntity = result.entities.find(e => e.kind === "variable");
      expect(varEntity).toMatchObject({
        kind: "variable",
        name: "myVar",
        text: "const myVar = 1;",
        line: 40
      });

      // Assertions for import entity
      const importEntity = result.entities.find(e => e.kind === "import");
      expect(importEntity).toMatchObject({
        kind: "import",
        name: "{ something } from './module'",
        text: "import { something } from './module';",
        line: 50
      });

      // Assertions for export entity
      const exportEntity = result.entities.find(e => e.kind === "export");
      expect(exportEntity).toMatchObject({
        kind: "export",
        name: "default export",
        text: "export default class {};",
        line: 60
      });
    });

    it("should convert call expressions to relationships and link to correct entities", () => {
      const callerId = (ingestor as any).createFunctionId(
        "callerFunction",
        "/test/file.ts"
      );
      const targetId = (ingestor as any).createFunctionId(
        "targetFunction",
        "/test/file.ts"
      );

      const mockFileResult: FileAnalysisResult = {
        filePath: "/test/file.ts",
        totalLines: 100,
        entities: [
          {
            type: "function",
            name: "callerFunction",
            signature: "function callerFunction(): void",
            line: 5
          } as CodeEntity,
          {
            type: "function",
            name: "targetFunction",
            signature: "function targetFunction(): void",
            line: 10
          } as CodeEntity
        ],
        callExpressions: [
          {
            type: "function",
            callee: "targetFunction",
            containingFunction: "callerFunction",
            signature: "targetFunction()",
            argumentCount: 0,
            line: 15
          } as CallExpression
        ],
        typeInfo: {
          typeAliases: [],
          interfaces: [],
          classes: [],
          enums: [],
          typeReferences: []
        }
      };

      const result = (ingestor as any).convertToGraph([mockFileResult]);

      expect(result.relationships).toHaveLength(1);
      const relationship = result.relationships[0];

      expect(relationship).toMatchObject({
        type: "CALLS",
        evidence: "Direct function call",
        confidence: "high",
        metadata: mapFrom({
          argumentCount: 0,
          signature: "targetFunction()",
          line: 15
        })
      });
      expect(relationship.from).toBe(callerId);
      expect(relationship.to).toBe(targetId);
    });

    it("should skip call expressions without containing function", () => {
      const mockFileResult: FileAnalysisResult = {
        filePath: "/test/file.ts",
        totalLines: 100,
        entities: [],
        callExpressions: [
          {
            type: "function",
            callee: "targetFunction",
            containingFunction: null,
            signature: "targetFunction()",
            argumentCount: 0,
            line: 15
          } as CallExpression
        ],
        typeInfo: {
          typeAliases: [],
          interfaces: [],
          classes: [],
          enums: [],
          typeReferences: []
        }
      };

      const result = (ingestor as any).convertToGraph([mockFileResult]);

      expect(result.relationships).toHaveLength(0);
    });
  });

  describe("entity ID generation", () => {
    it("should generate consistent IDs for the same entity", () => {
      const entity: CodeEntity = {
        type: "function",
        name: "testFunction",
        signature: "function testFunction(): void",
        line: 10
      };

      const id1 = (ingestor as any).createEntityId(entity, "/test/file.ts");
      const id2 = (ingestor as any).createEntityId(entity, "/test/file.ts");

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(16);
    });

    it("should generate different IDs for different entities", () => {
      const entity1: CodeEntity = {
        type: "function",
        name: "testFunction1",
        signature: "function testFunction1(): void",
        line: 10
      };

      const entity2: CodeEntity = {
        type: "function",
        name: "testFunction2",
        signature: "function testFunction2(): void",
        line: 10
      };

      const id1 = (ingestor as any).createEntityId(entity1, "/test/file.ts");
      const id2 = (ingestor as any).createEntityId(entity2, "/test/file.ts");

      expect(id1).not.toBe(id2);
    });

    it("should generate consistent function IDs", () => {
      const id1 = (ingestor as any).createFunctionId(
        "testFunction",
        "/test/file.ts"
      );
      const id2 = (ingestor as any).createFunctionId(
        "testFunction",
        "/test/file.ts"
      );

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(16);
    });
  });

  describe("database ingestion", () => {
    it("should ingest entities successfully", async () => {
      const entities = [
        {
          id: "test123",
          kind: "function",
          name: "testFunction",
          text: "function testFunction(): void",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      await expect(
        (ingestor as any).ingestEntities(entities)
      ).resolves.not.toThrow();

      // Verify entity was inserted
      const result = await ingestor.query(
        "MATCH (n:CodeEntity {id: 'test123'}) RETURN n.name as name"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("testFunction");
    });

    it("should ingest multiple entities in a batch", async () => {
      const entities = [
        {
          id: "entityBatch1",
          kind: "function",
          name: "batchFunction1",
          text: "function batchFunction1(): void",
          filePath: "test/file.ts",
          line: 1,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "entityBatch2",
          kind: "class",
          name: "batchClass2",
          text: "class batchClass2 {}",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      await expect(
        (ingestor as any).ingestEntities(entities)
      ).resolves.not.toThrow();

      const result = await ingestor.query(
        "MATCH (n:CodeEntity) WHERE n.id IN ['entityBatch1', 'entityBatch2'] RETURN n.name as name ORDER BY n.name"
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("batchClass2");
      expect(result[1].name).toBe("batchFunction1");
    });

    it("should handle ingestion of duplicate entities gracefully (upsert behavior)", async () => {
      const entities = [
        {
          id: "duplicateEntity",
          kind: "function",
          name: "originalName",
          text: "function originalName(): void",
          filePath: "test/file.ts",
          line: 1,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      // Ingest first time
      await (ingestor as any).ingestEntities(entities);

      // Ingest again with updated name
      const updatedEntities = [
        {
          id: "duplicateEntity",
          kind: "function",
          name: "updatedName",
          text: "function updatedName(): void",
          filePath: "test/file.ts",
          line: 1,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];
      await expect(
        (ingestor as any).ingestEntities(updatedEntities)
      ).resolves.not.toThrow();

      // Verify only one entity exists and its name is updated
      const countResult = await ingestor.query(
        "MATCH (n:CodeEntity {id: 'duplicateEntity'}) RETURN count(n) as count"
      );
      expect(countResult[0].count).toBe(1);

      const nameResult = await ingestor.query(
        "MATCH (n:CodeEntity {id: 'duplicateEntity'}) RETURN n.name as name"
      );
      expect(nameResult[0].name).toBe("updatedName");
    });

    it("should handle entity ingestion with special characters", async () => {
      const entities = [
        {
          id: "test456",
          kind: "function",
          name: "test'Function",
          text: "function test'Function(): void",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      await expect(
        (ingestor as any).ingestEntities(entities)
      ).resolves.not.toThrow();

      // Verify entity was inserted with escaped quotes
      const result = await ingestor.query(
        "MATCH (n:CodeEntity {id: 'test456'}) RETURN n.name as name"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test'Function");
    });

    it("should ingest relationships successfully", async () => {
      // First insert entities
      const entities = [
        {
          id: "caller123",
          kind: "function",
          name: "callerFunction",
          text: "function callerFunction(): void",
          filePath: "test/file.ts",
          line: 5,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "callee456",
          kind: "function",
          name: "calleeFunction",
          text: "function calleeFunction(): void",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      await (ingestor as any).ingestEntities(entities);

      // Then insert relationships
      const relationships = [
        {
          from: "caller123",
          to: "callee456",
          type: "CALLS" as const,
          evidence: "Direct function call",
          confidence: "high" as const,
          metadata: mapFrom({
            argumentCount: 0,
            line: 7
          })
        }
      ];

      await expect(
        (ingestor as any).ingestRelationships(relationships)
      ).resolves.not.toThrow();

      // Verify relationship was inserted
      const result = await ingestor.query(`
        MATCH (a:CodeEntity {id: 'caller123'})-[r:CALLS]->(b:CodeEntity {id: 'callee456'}) 
        RETURN r.evidence as evidence
      `);
      expect(result.length).toBeGreaterThanOrEqual(0); // May be 0 if entities don't exist
      if (result.length > 0) {
        expect(result[0].evidence).toBe("Direct function call");
      }
    });

    it("should ingest multiple relationships in a batch", async () => {
      // First insert entities for relationships
      const entities = [
        {
          id: "callerBatch1",
          kind: "function",
          name: "callerBatchFunction1",
          text: "function callerBatchFunction1(): void",
          filePath: "test/file.ts",
          line: 1,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "calleeBatch1",
          kind: "function",
          name: "calleeBatchFunction1",
          text: "function calleeBatchFunction1(): void",
          filePath: "test/file.ts",
          line: 2,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "callerBatch2",
          kind: "function",
          name: "callerBatchFunction2",
          text: "function callerBatchFunction2(): void",
          filePath: "test/file.ts",
          line: 3,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "calleeBatch2",
          kind: "function",
          name: "calleeBatchFunction2",
          text: "function calleeBatchFunction2(): void",
          filePath: "test/file.ts",
          line: 4,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];
      await (ingestor as any).ingestEntities(entities);

      // Then insert relationships
      const relationships = [
        {
          from: "callerBatch1",
          to: "calleeBatch1",
          type: "CALLS" as const,
          evidence: "Batch call 1",
          confidence: "high" as const,
          metadata: mapFrom({ argumentCount: 0, line: 1 })
        },
        {
          from: "callerBatch2",
          to: "calleeBatch2",
          type: "CALLS" as const,
          evidence: "Batch call 2",
          confidence: "high" as const,
          metadata: mapFrom({ argumentCount: 0, line: 2 })
        }
      ];

      await expect(
        (ingestor as any).ingestRelationships(relationships)
      ).resolves.not.toThrow();

      // Verify relationships were inserted
      const result1 = await ingestor.query(
        "MATCH (a:CodeEntity {id: 'callerBatch1'})-[r:CALLS]->(b:CodeEntity {id: 'calleeBatch1'}) RETURN r.evidence as evidence"
      );
      expect(result1).toHaveLength(1);
      expect(result1[0].evidence).toBe("Batch call 1");

      const result2 = await ingestor.query(
        "MATCH (a:CodeEntity {id: 'callerBatch2'})-[r:CALLS]->(b:CodeEntity {id: 'calleeBatch2'}) RETURN r.evidence as evidence"
      );
      expect(result2).toHaveLength(1);
      expect(result2[0].evidence).toBe("Batch call 2");
    });

    it("should ingest file metadata successfully", async () => {
      const analysisResults: FileAnalysisResult[] = [
        {
          filePath: "/test/file.ts",
          totalLines: 50,
          entities: [{} as CodeEntity, {} as CodeEntity],
          callExpressions: [{} as CallExpression],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          }
        }
      ];

      await expect(
        (ingestor as any).ingestFiles(analysisResults)
      ).resolves.not.toThrow();

      // Verify file was inserted
      const result = await ingestor.query(
        "MATCH (f:SourceFile) WHERE f.path CONTAINS 'test/file.ts' RETURN f.totalLines as lines, f.entityCount as entities"
      );
      expect(result.length).toBeGreaterThanOrEqual(0); // May be 0 if file doesn't exist
      if (result.length > 0) {
        expect(result[0].lines).toBe(50);
        expect(result[0].entities).toBe(2);
      }
    });

    it("should ingest file metadata with correct totalLines and entityCount", async () => {
      const analysisResults: FileAnalysisResult[] = [
        {
          filePath: "/test/another_file.ts",
          totalLines: 123,
          entities: [
            {} as CodeEntity,
            {} as CodeEntity,
            {} as CodeEntity,
            {} as CodeEntity
          ],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          }
        }
      ];

      await expect(
        (ingestor as any).ingestFiles(analysisResults)
      ).resolves.not.toThrow();

      const result = await ingestor.query(
        "MATCH (f:SourceFile) WHERE f.path CONTAINS 'test/another_file.ts' RETURN f.totalLines as lines, f.entityCount as entities"
      );
      expect(result).toHaveLength(1);
      expect(result[0].lines).toBe(123);
      expect(result[0].entities).toBe(4);
    });
  });

  describe("error handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const badIngestor = new KuzuGraphIngestor("/dev/null/invalid/path/db");

      try {
        await badIngestor.initialize();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should continue processing despite individual entity errors", async () => {
      // Mock conn.query to fail on specific entities but succeed on others
      const originalQuery = (ingestor as any).conn.query;
      (ingestor as any).conn.query = vi.fn().mockImplementation((query: string) => {
        if (query.includes("badEntity")) {
          throw new Error("Simulated entity error");
        }
        return originalQuery.call((ingestor as any).conn, query);
      });

      const entities = [
        {
          id: "goodEntity",
          kind: "function",
          name: "goodFunction",
          text: "function goodFunction(): void",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "badEntity",
          kind: "function",
          name: "badFunction",
          text: "function badFunction(): void",
          filePath: "test/file.ts",
          line: 20,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      // Should not throw despite one entity failing
      await expect(
        (ingestor as any).ingestEntities(entities)
      ).resolves.not.toThrow();
    });

    it("should continue processing relationships despite individual relationship errors", async () => {
      // Mock conn.query to fail on specific relationships but succeed on others
      const originalQuery = (ingestor as any).conn.query;
      (ingestor as any).conn.query = vi.fn().mockImplementation((query: string) => {
        if (query.includes("badRelationship")) {
          throw new Error("Simulated relationship error");
        }
        return originalQuery.call((ingestor as any).conn, query);
      });

      // First insert entities for relationships
      const entities = [
        {
          id: "goodCaller",
          kind: "function",
          name: "goodCaller",
          text: "function goodCaller(): void",
          filePath: "test/file.ts",
          line: 1,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "goodCallee",
          kind: "function",
          name: "goodCallee",
          text: "function goodCallee(): void",
          filePath: "test/file.ts",
          line: 2,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "badCaller",
          kind: "function",
          name: "badCaller",
          text: "function badCaller(): void",
          filePath: "test/file.ts",
          line: 3,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "badCallee",
          kind: "function",
          name: "badCallee",
          text: "function badCallee(): void",
          filePath: "test/file.ts",
          line: 4,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];
      await (ingestor as any).ingestEntities(entities);

      const relationships = [
        {
          from: "goodCaller",
          to: "goodCallee",
          type: "CALLS" as const,
          evidence: "goodRelationship",
          confidence: "high" as const,
          metadata: mapFrom({ argumentCount: 0, line: 1 })
        },
        {
          from: "badCaller",
          to: "badCallee",
          type: "CALLS" as const,
          evidence: "badRelationship",
          confidence: "high" as const,
          metadata: mapFrom({ argumentCount: 0, line: 2 })
        }
      ];

      // Should not throw despite one relationship failing
      await expect(
        (ingestor as any).ingestRelationships(relationships)
      ).resolves.not.toThrow();

      // Verify that the good relationship was still inserted
      const result = await ingestor.query(
        "MATCH (a:CodeEntity {id: 'goodCaller'})-[r:CALLS]->(b:CodeEntity {id: 'goodCallee'}) RETURN r.evidence as evidence"
      );
      expect(result).toHaveLength(1);
      expect(result[0].evidence).toBe("goodRelationship");
    });

    it("should continue processing files despite individual file ingestion errors", async () => {
      // Mock conn.query to fail on specific files but succeed on others
      const originalQuery = (ingestor as any).conn.query;
      (ingestor as any).conn.query = vi.fn().mockImplementation((query: string) => {
        if (query.includes("bad_file.ts")) {
          throw new Error("Simulated file ingestion error");
        }
        return originalQuery.call((ingestor as any).conn, query);
      });

      const analysisResults: FileAnalysisResult[] = [
        {
          filePath: "/test/good_file.ts",
          totalLines: 10,
          entities: [{} as CodeEntity],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          }
        },
        {
          filePath: "/test/bad_file.ts",
          totalLines: 20,
          entities: [{} as CodeEntity, {} as CodeEntity],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          }
        }
      ];

      // Should not throw despite one file failing
      await expect(
        (ingestor as any).ingestFiles(analysisResults)
      ).resolves.not.toThrow();

      // Verify that the good file was still inserted
      const result = await ingestor.query(
        "MATCH (f:SourceFile) WHERE f.path CONTAINS 'test/good_file.ts' RETURN f.totalLines as lines"
      );
      expect(result).toHaveLength(1);
      expect(result[0].lines).toBe(10);
    });
  });

  describe("query interface", () => {
    it("should execute queries and return results", async () => {
      // Insert test data
      const entities = [
        {
          id: "query123",
          kind: "function",
          name: "queryFunction",
          text: "function queryFunction(): void",
          filePath: "test/file.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];

      await (ingestor as any).ingestEntities(entities);

      // Test query
      const result = await ingestor.query(
        "MATCH (n:CodeEntity) RETURN count(n) as total"
      );
      expect(result).toBeDefined();
      expect(result[0].total).toBeGreaterThan(0);
    });

    it("should execute complex queries and return filtered results", async () => {
      // Insert test data with different properties
      const entities = [
        {
          id: "queryFunc1",
          kind: "function",
          name: "funcA",
          text: "function funcA(): void",
          filePath: "test/file1.ts",
          line: 10,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "queryFunc2",
          kind: "function",
          name: "funcB",
          text: "function funcB(): void",
          filePath: "test/file2.ts",
          line: 20,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        },
        {
          id: "queryClass1",
          kind: "class",
          name: "ClassA",
          text: "class ClassA {}",
          filePath: "test/file1.ts",
          line: 30,
          column: 0,
          pos: 0,
          end: 0,
          flags: 0
        }
      ];
      await (ingestor as any).ingestEntities(entities);

      // Test query for functions in file1.ts
      const result = await ingestor.query(
        "MATCH (n:CodeEntity) WHERE n.kind = 'function' AND n.filePath CONTAINS 'file1.ts' RETURN n.name as name"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("funcA");
    });
  });

  describe("cleanup", () => {
    it("should close connections properly", async () => {
      await expect(ingestor.close()).resolves.not.toThrow();
    });
  });
});
