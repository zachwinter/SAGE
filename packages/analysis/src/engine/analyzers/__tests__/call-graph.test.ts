import { describe, it, expect } from "vitest";
import { performCallTreeAnalysis, isBuiltinFunction } from "../call-graph.js";
import type { FileAnalysisResult } from "../../../types.js";

describe("call-graph", () => {
  describe("isBuiltinFunction", () => {
    it("should identify common builtin functions", () => {
      expect(isBuiltinFunction("console.log")).toBe(true);
      expect(isBuiltinFunction("console.error")).toBe(true);
      expect(isBuiltinFunction("setTimeout")).toBe(true);
      expect(isBuiltinFunction("parseInt")).toBe(true);
      expect(isBuiltinFunction("JSON.parse")).toBe(true);
      expect(isBuiltinFunction("Array.isArray")).toBe(true);
    });

    it("should identify Math functions", () => {
      expect(isBuiltinFunction("Math.random")).toBe(true);
      expect(isBuiltinFunction("Math.floor")).toBe(true);
      expect(isBuiltinFunction("Math.max")).toBe(true);
    });

    it("should return false for non-builtin functions", () => {
      expect(isBuiltinFunction("myFunction")).toBe(false);
      expect(isBuiltinFunction("custom.logger")).toBe(false);
      expect(isBuiltinFunction("MyClass.method")).toBe(false);
    });
  });

  describe("performCallTreeAnalysis", () => {
    it("should create empty call graphs when no analysis results provided", () => {
      const results: FileAnalysisResult[] = [];
      const analysis = performCallTreeAnalysis(results);
      
      expect(analysis.callGraph.size).toBe(0);
      expect(analysis.reverseCallGraph.size).toBe(0);
      expect(analysis.allFunctions.size).toBe(0);
      expect(analysis.analysisResults).toEqual(results);
    });

    it("should register functions in allFunctions set", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "functionA",
              line: 1,
              signature: "function functionA() {}"
            }
          ],
          callExpressions: [],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 1
        }
      ];
      
      const analysis = performCallTreeAnalysis(results);
      expect(analysis.allFunctions.has("/test/file1.ts:functionA")).toBe(true);
      expect(analysis.callGraph.has("/test/file1.ts:functionA")).toBe(true);
      expect(analysis.reverseCallGraph.has("/test/file1.ts:functionA")).toBe(true);
    });

    it("should build call graph for functions calling other functions in the same file", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "caller",
              line: 1,
              signature: "function caller() {}"
            },
            {
              type: "function",
              name: "callee",
              line: 5,
              signature: "function callee() {}"
            }
          ],
          callExpressions: [
            {
              callee: "callee",
              type: "function",
              line: 2,
              containingFunction: "caller",
              signature: "callee()",
              argumentCount: 0
            }
          ],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 10
        }
      ];
      
      const analysis = performCallTreeAnalysis(results);
      
      // Check that the call relationship is established
      const callerCalls = analysis.callGraph.get("/test/file1.ts:caller");
      expect(callerCalls).toBeDefined();
      expect(callerCalls!.has("/test/file1.ts:callee")).toBe(true);
      
      // Check reverse relationship
      const calleeCalledBy = analysis.reverseCallGraph.get("/test/file1.ts:callee");
      expect(calleeCalledBy).toBeDefined();
      expect(calleeCalledBy!.has("/test/file1.ts:caller")).toBe(true);
    });

    it("should handle calls to functions in other files", () => {
      const results: FileAnalysisResult[] = [
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
        },
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "main",
              line: 1,
              signature: "function main() {}"
            }
          ],
          callExpressions: [
            {
              callee: "helper",
              type: "function",
              line: 2,
              containingFunction: "main",
              signature: "helper()",
              argumentCount: 0
            }
          ],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 5
        }
      ];
      
      const analysis = performCallTreeAnalysis(results);
      
      // Check that both functions are registered
      expect(analysis.allFunctions.has("/test/file1.ts:main")).toBe(true);
      expect(analysis.allFunctions.has("/test/file2.ts:helper")).toBe(true);
      
      // Check that both functions have entries in call graphs
      expect(analysis.callGraph.has("/test/file1.ts:main")).toBe(true);
      expect(analysis.callGraph.has("/test/file2.ts:helper")).toBe(true);
      expect(analysis.reverseCallGraph.has("/test/file1.ts:main")).toBe(true);
      expect(analysis.reverseCallGraph.has("/test/file2.ts:helper")).toBe(true);
      
      // Check that the cross-file call relationship is established
      const mainCalls = analysis.callGraph.get("/test/file1.ts:main");
      expect(mainCalls).toBeDefined();
      expect(mainCalls!.has("/test/file2.ts:helper")).toBe(true);
      
      // Check reverse relationship
      const helperCalledBy = analysis.reverseCallGraph.get("/test/file2.ts:helper");
      expect(helperCalledBy).toBeDefined();
      expect(helperCalledBy!.has("/test/file1.ts:main")).toBe(true);
    });

    it("should create external references for calls to unknown functions", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "main",
              line: 1,
              signature: "function main() {}"
            }
          ],
          callExpressions: [
            {
              callee: "unknownFunction",
              type: "function",
              line: 2,
              containingFunction: "main",
              signature: "unknownFunction()",
              argumentCount: 0
            }
          ],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 5
        }
      ];
      
      const analysis = performCallTreeAnalysis(results);
      
      // Check that external reference is created
      const mainCalls = analysis.callGraph.get("/test/file1.ts:main");
      expect(mainCalls).toBeDefined();
      expect(mainCalls!.has("external:unknownFunction")).toBe(true);
      
      // Check reverse relationship
      const externalCalledBy = analysis.reverseCallGraph.get("external:unknownFunction");
      expect(externalCalledBy).toBeDefined();
      expect(externalCalledBy!.has("/test/file1.ts:main")).toBe(true);
    });

    it("should skip builtin functions unless showBuiltin option is true", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [
            {
              type: "function",
              name: "main",
              line: 1,
              signature: "function main() {}"
            }
          ],
          callExpressions: [
            {
              callee: "console.log",
              type: "method",
              line: 2,
              containingFunction: "main",
              signature: "console.log()",
              argumentCount: 1
            }
          ],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 5
        }
      ];
      
      // Test with default options (showBuiltin = false)
      const analysis1 = performCallTreeAnalysis(results);
      const mainCalls1 = analysis1.callGraph.get("/test/file1.ts:main");
      expect(mainCalls1).toBeDefined();
      expect(mainCalls1!.has("external:console.log")).toBe(false);
      
      // Test with showBuiltin = true
      const analysis2 = performCallTreeAnalysis(results, { showBuiltin: true });
      const mainCalls2 = analysis2.callGraph.get("/test/file1.ts:main");
      expect(mainCalls2).toBeDefined();
      expect(mainCalls2!.has("external:console.log")).toBe(true);
    });

    it("should handle calls with no containing function", () => {
      const results: FileAnalysisResult[] = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [
            {
              callee: "globalFunction",
              type: "function",
              line: 1,
              containingFunction: null,
              signature: "globalFunction()",
              argumentCount: 0
            }
          ],
          typeInfo: { typeAliases: [], interfaces: [], classes: [], enums: [], typeReferences: [] },
          totalLines: 5
        }
      ];
      
      const analysis = performCallTreeAnalysis(results);
      
      // Should not create any call relationships for calls with no containing function
      expect(analysis.callGraph.size).toBe(0);
      expect(analysis.reverseCallGraph.size).toBe(0);
    });
  });
});