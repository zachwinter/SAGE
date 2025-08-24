import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { analyzeFiles, analyzeFile } from "../analyzer.js";
import { readFileSync } from "fs";
import { join } from "path";
import type { AnalysisOptions } from "../../types.js";

describe("Analyzer Integration Tests", () => {
  const fixturesPath = join(process.cwd(), "src/engine/__tests__/fixtures");

  describe("Real TypeScript file analysis", () => {
    it("should analyze a complete TypeScript file with all entity types", () => {
      const filePath = join(fixturesPath, "sample.ts");
      const content = readFileSync(filePath, "utf8");
      const options: AnalysisOptions = { calls: true, types: true };

      const result = analyzeFile(filePath, content, options);

      // Should extract entities
      expect(result.entities.length).toBeGreaterThan(0);

      // Should find the User interface
      const interfaces = result.entities.filter(e => e.type === "interface");
      expect(interfaces.some(i => i.name === "User")).toBe(true);

      // Should find the UserService class
      const classes = result.entities.filter(e => e.type === "class");
      expect(classes.some(c => c.name === "UserService")).toBe(true);

      // Should find functions
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions.some(f => f.name === "validateEmail")).toBe(true);

      // Should find imports
      const imports = result.entities.filter(e => e.type === "import");
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.some(i => i.name.includes("readFileSync"))).toBe(true);

      // Should find exports
      const exports = result.entities.filter(e => e.type === "export");
      expect(exports.length).toBeGreaterThan(0);

      // Should extract call expressions
      expect(result.callExpressions.length).toBeGreaterThan(0);

      // Should have type information
      expect(result.typeInfo).toBeDefined();
      expect(result.typeInfo.interfaces?.length).toBeGreaterThan(0);
      expect(result.typeInfo.classes?.length).toBeGreaterThan(0);
    });

    it("should analyze function calls and relationships", () => {
      const filePath = join(fixturesPath, "calls.ts");
      const content = readFileSync(filePath, "utf8");
      const options: AnalysisOptions = { calls: true };

      const result = analyzeFile(filePath, content, options);

      // Should find function entities
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions.some(f => f.name === "caller")).toBe(true);
      expect(functions.some(f => f.name === "target")).toBe(true);
      expect(functions.some(f => f.name === "validate")).toBe(true);

      // Should extract call expressions
      expect(result.callExpressions.length).toBeGreaterThan(0);

      // Should find the call from caller to target
      const targetCall = result.callExpressions.find(
        call => call.callee === "target" && call.containingFunction === "caller"
      );
      expect(targetCall).toBeDefined();

      // Should find method calls
      const methodCalls = result.callExpressions.filter(
        call => call.type === "method"
      );
      expect(methodCalls.length).toBeGreaterThan(0);

      // Should find console.log calls
      const consoleCalls = result.callExpressions.filter(call =>
        call.callee.includes("console.log")
      );
      expect(consoleCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Rust file analysis", () => {
    it("should analyze Rust files correctly", () => {
      const filePath = join(fixturesPath, "sample.rs");
      const content = readFileSync(filePath, "utf8");

      const result = analyzeFile(filePath, content);

      expect(result.filePath).toBe(filePath);
      expect(result.entities.length).toBeGreaterThan(0);

      // This test verifies that Rust files are routed to the correct parser
      // and that various entities are found.
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions.some(f => f.name === "validate_email")).toBe(true);
      const structs = result.entities.filter(e => e.type === "struct");
      expect(structs.some(s => s.name === "User")).toBe(true);
      const enums = result.entities.filter(e => e.type === "enum");
      expect(enums.some(e => e.name === "UserStatus")).toBe(true);
    });
  });

  describe("Error handling with malformed files", () => {
    it("should handle malformed JavaScript gracefully", () => {
      const filePath = join(fixturesPath, "malformed.js");
      const content = readFileSync(filePath, "utf8");

      const result = analyzeFile(filePath, content);

      // Should not throw and should return a result
      expect(result).toBeDefined();
      expect(result.filePath).toBe(filePath);
      expect(result.totalLines).toBeGreaterThan(1);

      // May or may not find entities depending on parser robustness
      expect(Array.isArray(result.entities)).toBe(true);
    });
  });

  describe("Multiple file analysis", () => {
    it("should analyze multiple files of different types", () => {
      const files = [
        join(fixturesPath, "sample.ts"),
        join(fixturesPath, "calls.ts"),
        join(fixturesPath, "sample.rs")
      ];
      const options: AnalysisOptions = { calls: true };

      const results = analyzeFiles(files, options);

      expect(results.length).toBe(3);

      // Each result should have the correct file path
      expect(results[0].filePath).toBe(files[0]);
      expect(results[1].filePath).toBe(files[1]);
      expect(results[2].filePath).toBe(files[2]);

      // Should have found entities in each file
      results.forEach(result => {
        expect(result.entities.length).toBeGreaterThan(0);
      });

      // Should have call expressions where requested
      const tsResults = results.filter(r => r.filePath.endsWith(".ts"));
      tsResults.forEach(result => {
        expect(Array.isArray(result.callExpressions)).toBe(true);
      });
    });

    it("should return analysis for all files, even those with no entities", () => {
      const files = [
        join(fixturesPath, "sample.ts"), // has many entities
        join(fixturesPath, "malformed.js") // may have few/no entities
      ];
      const options: AnalysisOptions = {}; // no calls or types

      const results = analyzeFiles(files, options);

      // Should return a result for every file
      expect(results.length).toBe(2);

      // The sample file should have entities
      const sampleResult = results.find(r => r.filePath.endsWith("sample.ts"));
      expect(sampleResult).toBeDefined();
      expect(sampleResult?.entities.length).toBeGreaterThan(0);

      // The malformed file should still be in the results, even if it has no entities
      const malformedResult = results.find(r => r.filePath.endsWith("malformed.js"));
      expect(malformedResult).toBeDefined();
      expect(Array.isArray(malformedResult?.entities)).toBe(true);
    });
  });

  describe("Options handling", () => {
    it("should include call expressions only when requested", () => {
      const filePath = join(fixturesPath, "calls.ts");
      const content = readFileSync(filePath, "utf8");

      // Without calls option
      const resultWithoutCalls = analyzeFile(filePath, content, {});
      expect(resultWithoutCalls.callExpressions).toEqual([]);

      // With calls option
      const resultWithCalls = analyzeFile(filePath, content, { calls: true });
      expect(resultWithCalls.callExpressions.length).toBeGreaterThan(0);
    });

    it("should include type information only when requested", () => {
      const filePath = join(fixturesPath, "sample.ts");
      const content = readFileSync(filePath, "utf8");

      // Without types option
      const resultWithoutTypes = analyzeFile(filePath, content, {});
      expect(resultWithoutTypes.typeInfo).toEqual({});

      // With types option
      const resultWithTypes = analyzeFile(filePath, content, { types: true });
      expect(resultWithTypes.typeInfo).not.toEqual({});
      expect(resultWithTypes.typeInfo.interfaces).toBeDefined();
    });
  });
});
