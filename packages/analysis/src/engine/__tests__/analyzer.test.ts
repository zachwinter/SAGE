import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { analyzeFiles, analyzeFile } from "../analyzer.js";
import type { AnalysisOptions } from "../../types.js";

// Mock fs module
vi.mock("fs");

const mockFs = vi.mocked(fs);

// Mock the parser modules
vi.mock("../parser/ts-ast-extractor.js", () => ({
  extractEntitiesFromAST: vi.fn(),
  extractCallExpressions: vi.fn(),
  extractTypeInformation: vi.fn()
}));

vi.mock("../parser/rust-regex-parser.js", () => ({
  analyzeRustFile: vi.fn()
}));

vi.mock("../parser/basic-js-parser.js", () => ({
  analyzeFileBasic: vi.fn()
}));

// Mock TypeScript
vi.mock("typescript", () => ({
  default: {
    createSourceFile: vi.fn(),
    ScriptTarget: { Latest: 99 }
  }
}));

describe("Analyzer Core Engine", () => {
  let mockExtractEntitiesFromAST: any;
  let mockExtractCallExpressions: any;
  let mockExtractTypeInformation: any;
  let mockAnalyzeRustFile: any;
  let mockAnalyzeFileBasic: any;
  let mockTsCreateSourceFile: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Import mocked modules
    const tsExtractor = await import("../parser/ts-ast-extractor.js");
    const rustParser = await import("../parser/rust-regex-parser.js");
    const basicParser = await import("../parser/basic-js-parser.js");
    const ts = await import("typescript");

    mockExtractEntitiesFromAST = vi.mocked(tsExtractor.extractEntitiesFromAST);
    mockExtractCallExpressions = vi.mocked(tsExtractor.extractCallExpressions);
    mockExtractTypeInformation = vi.mocked(tsExtractor.extractTypeInformation);
    mockAnalyzeRustFile = vi.mocked(rustParser.analyzeRustFile);
    mockAnalyzeFileBasic = vi.mocked(basicParser.analyzeFileBasic);
    mockTsCreateSourceFile = vi.mocked(ts.default.createSourceFile);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("analyzeFiles", () => {
    it("should analyze multiple files and return results", () => {
      const files = ["/test/file1.ts", "/test/file2.ts"];
      const options: AnalysisOptions = {};

      mockFs.readFileSync
        .mockReturnValueOnce("function test1() {}")
        .mockReturnValueOnce("function test2() {}");

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([
        {
          type: "function",
          name: "test1",
          line: 1,
          signature: "function test1() {}"
        }
      ]);

      const results = analyzeFiles(files, options);

      expect(results).toHaveLength(2);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
      expect(mockFs.readFileSync).toHaveBeenCalledWith("/test/file1.ts", "utf8");
      expect(mockFs.readFileSync).toHaveBeenCalledWith("/test/file2.ts", "utf8");
    });

    it("should return an empty array when analyzing an empty list of files", () => {
      const files: string[] = [];
      const options: AnalysisOptions = {};

      const results = analyzeFiles(files, options);

      expect(results).toEqual([]);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it("should include files with no entities in the results", () => {
      const files = ["/test/empty.ts", "/test/withEntities.ts"];

      mockFs.readFileSync
        .mockReturnValueOnce("// empty file")
        .mockReturnValueOnce("function test() {}");

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST
        .mockReturnValueOnce([]) // empty file
        .mockReturnValueOnce([
          {
            type: "function",
            name: "test",
            line: 1,
            signature: "function test() {}"
          }
        ]);

      const results = analyzeFiles(files);

      expect(results).toHaveLength(2);
      expect(
        results.find(r => r.filePath === "/test/empty.ts")?.entities
      ).toHaveLength(0);
      expect(
        results.find(r => r.filePath === "/test/withEntities.ts")?.entities
      ).toHaveLength(1);
    });

    it("should include files with no entities when collecting calls", () => {
      const files = ["/test/calls-only.ts"];
      const options: AnalysisOptions = { calls: true };

      mockFs.readFileSync.mockReturnValueOnce("someFunction();");

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractCallExpressions.mockReturnValue([
        {
          callee: "someFunction",
          type: "function",
          line: 1,
          containingFunction: null,
          signature: "someFunction()",
          argumentCount: 0
        }
      ]);

      const results = analyzeFiles(files, options);

      expect(results).toHaveLength(1);
      expect(results[0].callExpressions).toHaveLength(1);
    });

    it("should handle file read errors gracefully", () => {
      const files = ["/test/missing.ts", "/test/valid.ts"];

      mockFs.readFileSync
        .mockImplementationOnce(() => {
          throw new Error("ENOENT: no such file or directory");
        })
        .mockReturnValueOnce("function test() {}");

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([
        {
          type: "function",
          name: "test",
          line: 1,
          signature: "function test() {}"
        }
      ]);

      const results = analyzeFiles(files);

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe("/test/valid.ts");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Could not read file /test/missing.ts")
      );
    });
  });

  describe("analyzeFile", () => {
    it("should analyze TypeScript files using AST parser", () => {
      const filePath = "/test/file.ts";
      const content = "function hello() { return 'world'; }";

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([
        {
          type: "function",
          name: "hello",
          line: 1,
          signature: "function hello() { return 'world'; }"
        }
      ]);

      const result = analyzeFile(filePath, content);

      expect(result.filePath).toBe(filePath);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe("hello");
      expect(result.totalLines).toBe(1);
      expect(result.sourceFile).toBe(mockSourceFile);
      expect(mockTsCreateSourceFile).toHaveBeenCalledWith(
        filePath,
        content,
        99, // ScriptTarget.Latest
        true
      );
    });

    it("should analyze Rust files using Rust parser", () => {
      const filePath = "/test/file.rs";
      const content = 'fn hello() -> &str { "world" }';

      const mockRustResult = {
        filePath,
        entities: [
          {
            type: "function",
            name: "hello",
            line: 1,
            signature: "fn hello() -> &str"
          }
        ],
        callExpressions: [],
        typeInfo: {},
        totalLines: 1
      };

      mockAnalyzeRustFile.mockReturnValue(mockRustResult);

      const result = analyzeFile(filePath, content);

      expect(result).toEqual(mockRustResult);
      expect(mockAnalyzeRustFile).toHaveBeenCalledWith(filePath, content, {});
    });

    it("should extract call expressions when requested", () => {
      const filePath = "/test/file.ts";
      const content = "function caller() { target(); }";
      const options: AnalysisOptions = { calls: true };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractCallExpressions.mockReturnValue([
        {
          callee: "target",
          type: "function",
          line: 1,
          containingFunction: "caller",
          signature: "target()",
          argumentCount: 0
        }
      ]);

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toHaveLength(1);
      expect(result.callExpressions[0].callee).toBe("target");
      expect(mockExtractCallExpressions).toHaveBeenCalledWith(mockSourceFile);
    });

    it("should extract type information when requested", () => {
      const filePath = "/test/file.ts";
      const content = "interface User { name: string; }";
      const options: AnalysisOptions = { types: true };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractTypeInformation.mockReturnValue({
        typeAliases: [],
        interfaces: [
          {
            name: "User",
            line: 1,
            typeParameters: [],
            extends: [],
            properties: 1,
            isExported: false
          }
        ],
        classes: [],
        enums: [],
        typeReferences: []
      });

      const result = analyzeFile(filePath, content, options);

      expect(result.typeInfo.interfaces).toHaveLength(1);
      expect(result.typeInfo.interfaces[0].name).toBe("User");
      expect(mockExtractTypeInformation).toHaveBeenCalledWith(mockSourceFile);
    });

    it("should calculate total lines correctly", () => {
      const filePath = "/test/multiline.ts";
      const content = "function test() {\n  return 'hello';\n}";

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content);

      expect(result.totalLines).toBe(3);
    });

    it("should not extract call expressions or type info when options are explicitly false", () => {
      const filePath = "/test/file.ts";
      const content = "function test() { call(); } interface MyInterface {}";
      const options: AnalysisOptions = { calls: false, types: false };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toEqual([]);
      expect(mockExtractCallExpressions).not.toHaveBeenCalled();
      expect(result.typeInfo).toEqual({});
      expect(mockExtractTypeInformation).not.toHaveBeenCalled();
    });

    it("should extract call expressions but not type info when calls is true and types is false", () => {
      const filePath = "/test/file.ts";
      const content = "function test() { call(); } interface MyInterface {}";
      const options: AnalysisOptions = { calls: true, types: false };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractCallExpressions.mockReturnValue([
        {
          callee: "call",
          type: "function",
          line: 1,
          containingFunction: "test",
          signature: "call()",
          argumentCount: 0
        }
      ]);

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toHaveLength(1);
      expect(mockExtractCallExpressions).toHaveBeenCalled();
      expect(result.typeInfo).toEqual({});
      expect(mockExtractTypeInformation).not.toHaveBeenCalled();
    });

    it("should extract type info but not call expressions when types is true and calls is false", () => {
      const filePath = "/test/file.ts";
      const content = "function test() { call(); } interface MyInterface {}";
      const options: AnalysisOptions = { calls: false, types: true };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractTypeInformation.mockReturnValue({
        typeAliases: [],
        interfaces: [
          {
            name: "MyInterface",
            line: 1,
            typeParameters: [],
            extends: [],
            properties: 0,
            isExported: false
          }
        ],
        classes: [],
        enums: [],
        typeReferences: []
      });

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toEqual([]);
      expect(mockExtractCallExpressions).not.toHaveBeenCalled();
      expect(result.typeInfo.interfaces).toHaveLength(1);
      expect(mockExtractTypeInformation).toHaveBeenCalled();
    });

    it("should handle empty call expressions when calls not requested", () => {
      const filePath = "/test/file.ts";
      const content = "function test() {}";
      const options: AnalysisOptions = {}; // calls undefined

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toEqual([]);
      expect(mockExtractCallExpressions).not.toHaveBeenCalled();
    });

    it("should handle empty type info when types not requested", () => {
      const filePath = "/test/file.ts";
      const content = "interface Test {}";
      const options: AnalysisOptions = { types: false };

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content, options);

      expect(result.typeInfo).toEqual({});
      expect(mockExtractTypeInformation).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty file content", () => {
      const filePath = "/test/empty.ts";
      const content = "";

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content);

      expect(result.entities).toHaveLength(0);
      expect(result.totalLines).toBe(1); // empty string split gives one empty line
    });
  });
});
