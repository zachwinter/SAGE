import { describe, it, expect } from "vitest";
import { performTopologicalSort, extractEntityDependencies } from "../dependency-sorter.js";
import type { FileAnalysisResult, CodeEntity } from "../../../types.js";

describe("dependency-sorter", () => {
  describe("extractEntityDependencies", () => {
    it("should extract dependencies from import entities", () => {
      const entity: CodeEntity = {
        type: "import",
        name: "someFunction",
        line: 1,
        signature: "import { someFunction } from './other-file';"
      };
      
      const fileResult: FileAnalysisResult = {
        filePath: "/test/file1.ts",
        entities: [],
        callExpressions: [],
        typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
        totalLines: 5
      };
      
      const allEntities: CodeEntity[] = [
        {
          type: "function",
          name: "someFunction",
          line: 1,
          signature: "function someFunction() {}",
          filePath: "/test/other-file.ts",
          id: "/test/other-file.ts:someFunction"
        }
      ];
      
      const dependencies = extractEntityDependencies(entity, fileResult, allEntities);
      expect(dependencies.has("/test/other-file.ts:someFunction")).toBe(true);
    });

    it("should extract dependencies from multiple imports", () => {
      const entity: CodeEntity = {
        type: "import",
        name: "func1, func2",
        line: 1,
        signature: "import { func1, func2 } from './other-file';"
      };
      
      const fileResult: FileAnalysisResult = {
        filePath: "/test/file1.ts",
        entities: [],
        callExpressions: [],
        typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
        totalLines: 5
      };
      
      const allEntities: CodeEntity[] = [
        {
          type: "function",
          name: "func1",
          line: 1,
          signature: "function func1() {}",
          filePath: "/test/other-file.ts",
          id: "/test/other-file.ts:func1"
        },
        {
          type: "function",
          name: "func2",
          line: 2,
          signature: "function func2() {}",
          filePath: "/test/other-file.ts",
          id: "/test/other-file.ts:func2"
        }
      ];
      
      const dependencies = extractEntityDependencies(entity, fileResult, allEntities);
      expect(dependencies.has("/test/other-file.ts:func1")).toBe(true);
      expect(dependencies.has("/test/other-file.ts:func2")).toBe(true);
    });

    it("should extract dependencies from entity signatures", () => {
      const entity: CodeEntity = {
        type: "function",
        name: "main",
        line: 1,
        signature: "function main() { helper(); }"
      };
      
      const fileResult: FileAnalysisResult = {
        filePath: "/test/file1.ts",
        entities: [],
        callExpressions: [],
        typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
        totalLines: 5
      };
      
      const allEntities: CodeEntity[] = [
        entity,
        {
          type: "function",
          name: "helper",
          line: 1,
          signature: "function helper() {}",
          filePath: "/test/file1.ts",
          id: "/test/file1.ts:helper"
        }
      ];
      
      const dependencies = extractEntityDependencies(entity, fileResult, allEntities);
      expect(dependencies.has("/test/file1.ts:helper")).toBe(true);
    });

    it("should skip common keywords when extracting from signatures", () => {
      const entity: CodeEntity = {
        type: "function",
        name: "main",
        line: 1,
        signature: "function main() { if (condition) { return value; } }"
      };
      
      const fileResult: FileAnalysisResult = {
        filePath: "/test/file1.ts",
        entities: [],
        callExpressions: [],
        typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
        totalLines: 5
      };
      
      const allEntities: CodeEntity[] = [entity];
      
      const dependencies = extractEntityDependencies(entity, fileResult, allEntities);
      // Should not have dependencies on keywords like "if", "return", etc.
      expect(dependencies.size).toBe(0);
    });

    it("should return empty set for entities without dependencies", () => {
      const entity: CodeEntity = {
        type: "variable",
        name: "CONSTANT",
        line: 1,
        signature: "const CONSTANT = 42;"
      };
      
      const fileResult: FileAnalysisResult = {
        filePath: "/test/file1.ts",
        entities: [],
        callExpressions: [],
        typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
        totalLines: 3
      };
      
      const allEntities: CodeEntity[] = [entity];
      
      const dependencies = extractEntityDependencies(entity, fileResult, allEntities);
      expect(dependencies.size).toBe(0);
    });
  });

  describe("performTopologicalSort", () => {
    it("should return empty sorted and cycles arrays when no analysis results provided", () => {
      const results: FileAnalysisResult[] = [];
      const sortResult = performTopologicalSort(results);
      
      expect(sortResult.sorted).toEqual([]);
      expect(sortResult.cycles).toEqual([]);
    });

    it("should sort entities with no dependencies first", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "independent",
              line: 1,
              signature: "function independent() {}"
            },
            {
              type: "function",
              name: "dependent",
              line: 5,
              signature: "function dependent() { independent(); }"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 10
        }
      ];
      
      const sortResult = performTopologicalSort(results);
      
      // The independent function should come first
      expect(sortResult.sorted.length).toBe(2);
      expect(sortResult.sorted[0].name).toBe("independent");
      expect(sortResult.sorted[1].name).toBe("dependent");
      expect(sortResult.cycles).toEqual([]);
    });

    it("should handle entities with no cycles", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "A",
              line: 1,
              signature: "function A() {}"
            },
            {
              type: "function",
              name: "B",
              line: 5,
              signature: "function B() { A(); }"
            },
            {
              type: "function",
              name: "C",
              line: 10,
              signature: "function C() { B(); A(); }"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 15
        }
      ];
      
      const sortResult = performTopologicalSort(results);
      
      // Should be sorted correctly (A, B, C) or (A, C, B) depending on implementation
      expect(sortResult.sorted.length).toBe(3);
      expect(sortResult.cycles).toEqual([]);
    });

    it("should identify cyclic dependencies", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "A",
              line: 1,
              signature: "function A() { B(); }"
            },
            {
              type: "function",
              name: "B",
              line: 5,
              signature: "function B() { A(); }"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 10
        }
      ];
      
      const sortResult = performTopologicalSort(results);
      
      // Both A and B should be in cycles since they depend on each other
      expect(sortResult.sorted.length).toBe(0);
      expect(sortResult.cycles.length).toBe(2);
      const cycleNames = sortResult.cycles.map(e => e.name);
      expect(cycleNames).toContain("A");
      expect(cycleNames).toContain("B");
    });

    it("should handle cross-file dependencies", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "main",
              line: 1,
              signature: "function main() { helper(); }"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 5
        },
        {
          filePath: "/test/file2.ts",
          entities: [
            {
              type: "function",
              name: "helper",
              line: 1,
              signature: "function helper() {}"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 3
        }
      ];
      
      const sortResult = performTopologicalSort(results);
      
      // helper should come before main
      expect(sortResult.sorted.length).toBe(2);
      expect(sortResult.sorted[0].name).toBe("helper");
      expect(sortResult.sorted[1].name).toBe("main");
      expect(sortResult.cycles).toEqual([]);
    });
  });
});