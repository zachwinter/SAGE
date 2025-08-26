import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisOptions } from "../../types.js";
import { analyzeFile, analyzeFiles } from "../analyzer.js";

// Mock fs module
vi.mock("fs");

const mockFs = vi.mocked(fs);

// Mock the parser modules
vi.mock("../parser/ts-ast-extractor.js", () => ({
  extractEntitiesFromAST: vi.fn(),
  extractCallExpressions: vi.fn(),
  extractTypeInformation: vi.fn()
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

    const basicParser = await import("../parser/basic-js-parser.js");
    const ts = await import("typescript");

    mockExtractEntitiesFromAST = vi.mocked(tsExtractor.extractEntitiesFromAST);
    mockExtractCallExpressions = vi.mocked(tsExtractor.extractCallExpressions);
    mockExtractTypeInformation = vi.mocked(tsExtractor.extractTypeInformation);
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

      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
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

      // Enhanced assertions for result structure and data quality
      expect(results).toHaveLength(2);
      expect(Array.isArray(results)).toBe(true);

      // Validate each result has required properties with correct types
      results.forEach((result, index) => {
        expect(result).toHaveProperty("filePath", files[index]);
        expect(result).toHaveProperty("entities");
        expect(result).toHaveProperty("callExpressions");
        expect(result).toHaveProperty("typeInfo");
        expect(result).toHaveProperty("totalLines");
        expect(Array.isArray(result.entities)).toBe(true);
        expect(Array.isArray(result.callExpressions)).toBe(true);
        expect(typeof result.typeInfo).toBe("object");
        expect(typeof result.totalLines).toBe("number");
        expect(result.totalLines).toBeGreaterThanOrEqual(1);
      });

      // Verify mock interactions with detailed parameter checking
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
      expect(mockFs.readFileSync).toHaveBeenNthCalledWith(
        1,
        "/test/file1.ts",
        "utf8"
      );
      expect(mockFs.readFileSync).toHaveBeenNthCalledWith(
        2,
        "/test/file2.ts",
        "utf8"
      );

      // Verify TypeScript parser was called for each file
      expect(mockTsCreateSourceFile).toHaveBeenCalledTimes(2);
      expect(mockExtractEntitiesFromAST).toHaveBeenCalledTimes(2);
    });

    it("should return an empty array when analyzing an empty list of files", () => {
      const files: string[] = [];
      const options: AnalysisOptions = {};

      const results = analyzeFiles(files, options);

      expect(results).toEqual([]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(mockTsCreateSourceFile).not.toHaveBeenCalled();
      expect(mockExtractEntitiesFromAST).not.toHaveBeenCalled();
    });

    it("should include files with no entities in the results", () => {
      const files = ["/test/empty.ts", "/test/withEntities.ts"];

      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
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

      // Enhanced validation for empty file result
      const emptyFileResult = results.find(r => r.filePath === "/test/empty.ts");
      expect(emptyFileResult).toBeDefined();
      expect(emptyFileResult?.entities).toHaveLength(0);
      expect(emptyFileResult?.entities).toEqual([]);
      expect(emptyFileResult?.totalLines).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(emptyFileResult?.callExpressions)).toBe(true);

      // Enhanced validation for file with entities
      const withEntitiesResult = results.find(
        r => r.filePath === "/test/withEntities.ts"
      );
      expect(withEntitiesResult).toBeDefined();
      expect(withEntitiesResult?.entities).toHaveLength(1);
      expect(withEntitiesResult?.entities[0]).toMatchObject({
        type: "function",
        name: "test",
        line: 1,
        signature: expect.stringContaining("function test()")
      });
      expect(withEntitiesResult?.totalLines).toBeGreaterThanOrEqual(1);
    });

    it("should include files with no entities when collecting calls", () => {
      const files = ["/test/calls-only.ts"];
      const options: AnalysisOptions = { calls: true };

      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
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

      // Enhanced validation for call expressions
      const result = results[0];
      expect(result.callExpressions).toHaveLength(1);
      expect(result.callExpressions[0]).toMatchObject({
        callee: "someFunction",
        type: "function",
        line: 1,
        containingFunction: null,
        signature: "someFunction()",
        argumentCount: 0
      });

      // Verify file structure
      expect(result.filePath).toBe("/test/calls-only.ts");
      expect(result.entities).toHaveLength(0);
      expect(result.totalLines).toBeGreaterThanOrEqual(1);
    });

    it("should handle file read errors gracefully", () => {
      const files = ["/test/missing.ts", "/test/valid.ts"];

      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
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

      // Enhanced validation for error handling
      expect(results).toHaveLength(1);
      expect(Array.isArray(results)).toBe(true);

      const validResult = results[0];
      expect(validResult.filePath).toBe("/test/valid.ts");
      expect(validResult.entities).toHaveLength(1);
      expect(validResult.entities[0]).toMatchObject({
        type: "function",
        name: "test",
        line: 1,
        signature: expect.stringContaining("function test()")
      });

      // Verify error was properly logged
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(
          /Warning: Could not read file \/test\/missing\.ts.*ENOENT/
        )
      );

      // Verify fs interactions
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2); // One failed, one succeeded
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

      // Enhanced validation of result structure and data quality
      expect(result).toMatchObject({
        filePath: filePath,
        totalLines: 1,
        sourceFile: mockSourceFile
      });

      // Validate entities array and content
      expect(result.entities).toHaveLength(1);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities[0]).toMatchObject({
        type: "function",
        name: "hello",
        line: 1,
        signature: expect.stringContaining("function hello()")
      });

      // Validate call expressions are always included
      expect(Array.isArray(result.callExpressions)).toBe(true);

      // Validate TypeScript parser interaction
      expect(mockTsCreateSourceFile).toHaveBeenCalledTimes(1);
      expect(mockTsCreateSourceFile).toHaveBeenCalledWith(
        filePath,
        content,
        99, // ScriptTarget.Latest
        true
      );
      expect(mockExtractEntitiesFromAST).toHaveBeenCalledWith(mockSourceFile, {});
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

      // Enhanced validation for call expression extraction
      expect(result.callExpressions).toHaveLength(1);
      expect(Array.isArray(result.callExpressions)).toBe(true);

      const callExpression = result.callExpressions[0];
      expect(callExpression).toMatchObject({
        callee: "target",
        type: "function",
        line: 1,
        containingFunction: "caller",
        signature: "target()",
        argumentCount: 0
      });

      // Verify parser interactions
      expect(mockExtractCallExpressions).toHaveBeenCalledTimes(1);
      expect(mockExtractCallExpressions).toHaveBeenCalledWith(mockSourceFile);
      expect(mockExtractEntitiesFromAST).toHaveBeenCalledWith(
        mockSourceFile,
        options
      );
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

      // Enhanced validation for type information extraction
      expect(result.typeInfo).toBeDefined();
      expect(typeof result.typeInfo).toBe("object");
      expect(result.typeInfo.interfaces).toHaveLength(1);
      expect(Array.isArray(result.typeInfo.interfaces)).toBe(true);

      const userInterface = result.typeInfo.interfaces[0];
      expect(userInterface).toMatchObject({
        name: "User",
        line: 1,
        typeParameters: [],
        extends: [],
        properties: 1,
        isExported: false
      });

      // Verify type extraction was called
      expect(mockExtractTypeInformation).toHaveBeenCalledTimes(1);
      expect(mockExtractTypeInformation).toHaveBeenCalledWith(mockSourceFile);

      // Verify call expressions are still extracted when types are requested
      expect(Array.isArray(result.callExpressions)).toBe(true);
      expect(mockExtractCallExpressions).toHaveBeenCalledWith(mockSourceFile);
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

    it("should always extract call expressions regardless of options", () => {
      const filePath = "/test/file.ts";
      const content = "function test() { call(); } interface MyInterface {}";
      const options: AnalysisOptions = { calls: false, types: false };

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

    it("should extract call expressions but not type info when types is true and calls is false", () => {
      const filePath = "/test/file.ts";
      const content = "function test() { call(); } interface MyInterface {}";
      const options: AnalysisOptions = { calls: false, types: true };

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

      expect(result.callExpressions).toHaveLength(1);
      expect(mockExtractCallExpressions).toHaveBeenCalled();
      expect(result.typeInfo.interfaces).toHaveLength(1);
      expect(mockExtractTypeInformation).toHaveBeenCalled();
    });

    it("should always extract call expressions even when calls option is not provided", () => {
      const filePath = "/test/file.ts";
      const content = "function test() {}";
      const options: AnalysisOptions = {}; // calls undefined

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);
      mockExtractCallExpressions.mockReturnValue([]);

      const result = analyzeFile(filePath, content, options);

      expect(result.callExpressions).toEqual([]);
      expect(mockExtractCallExpressions).toHaveBeenCalled();
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

      // Enhanced validation for empty file handling
      expect(result).toMatchObject({
        filePath: filePath,
        totalLines: 1 // empty string split gives one empty line
      });
      expect(result.entities).toHaveLength(0);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.callExpressions)).toBe(true);
      expect(typeof result.typeInfo).toBe("object");

      // Verify parser was still called for empty file
      expect(mockTsCreateSourceFile).toHaveBeenCalledWith(
        filePath,
        content,
        99,
        true
      );
      expect(mockExtractEntitiesFromAST).toHaveBeenCalledWith(mockSourceFile, {});
    });

    it("should handle very large files without issues", () => {
      const filePath = "/test/large.ts";
      const largeContent = "function test() {}\n".repeat(10000);

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, largeContent);

      expect(result.totalLines).toBe(10001); // 10000 functions + 1 empty line at end
      expect(result.filePath).toBe(filePath);
      expect(typeof result.totalLines).toBe("number");
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it("should handle files with only whitespace and comments", () => {
      const filePath = "/test/whitespace.ts";
      const content = "\n\n  \t  \n// Comment\n/* Block comment */\n\n";

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockReturnValue([]);

      const result = analyzeFile(filePath, content);

      expect(result.entities).toHaveLength(0);
      expect(result.totalLines).toBe(7); // Adjusted for actual line count
      expect(result.filePath).toBe(filePath);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.callExpressions)).toBe(true);
    });

    it("should handle unsupported file extensions gracefully", () => {
      const filePath = "/test/unknown.xyz";
      const content = "some content";

      const result = analyzeFile(filePath, content);

      expect(result.filePath).toBe(filePath);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.callExpressions)).toBe(true);
      expect(typeof result.typeInfo).toBe("object");
      expect(typeof result.totalLines).toBe("number");
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it("should preserve exact file paths with special characters", () => {
      const specialPath = "/test/file-with-special_chars@123.ts";
      const content = "function test() {}";

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

      const result = analyzeFile(specialPath, content);

      expect(result.filePath).toBe(specialPath);
      expect(result.entities[0]).toHaveProperty("type", "function");
      expect(result.entities[0]).toHaveProperty("name", "test");
    });
  });

  describe("comprehensive error scenarios", () => {
    it("should handle TypeScript parser throwing errors", () => {
      const filePath = "/test/broken.ts";
      const content = "invalid typescript syntax {{{";

      mockTsCreateSourceFile.mockImplementation(() => {
        throw new Error("TypeScript parse error");
      });

      const result = analyzeFile(filePath, content);

      expect(result.filePath).toBe(filePath);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.callExpressions)).toBe(true);
      expect(typeof result.typeInfo).toBe("object");
    });

    it("should handle entity extraction throwing errors", () => {
      const filePath = "/test/extraction-error.ts";
      const content = "function test() {}";

      const mockSourceFile = { kind: "SourceFile" } as any;
      mockTsCreateSourceFile.mockReturnValue(mockSourceFile);
      mockExtractEntitiesFromAST.mockImplementation(() => {
        throw new Error("Entity extraction failed");
      });

      // Should handle the error gracefully
      const result = analyzeFile(filePath, content);

      expect(result.filePath).toBe(filePath);
      expect(console.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("Entity extraction failed")
      );
    });
  });
});
