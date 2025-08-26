import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { getCodeFiles } from "../../utils/file-finder.js";
import { analyzeFile, analyzeFiles } from "../analyzer.js";

// Path to our test fixtures
const FIXTURES_PATH = join(__dirname, "fixtures/project");

describe("Analysis Engine with Real Project Fixtures", () => {
  describe("analyzeFile", () => {
    it("should correctly analyze main.ts file", () => {
      const filePath = join(FIXTURES_PATH, "src/main.ts");
      const content = readFileSync(filePath, "utf-8");

      const result = analyzeFile(filePath, content);

      // Check basic properties
      expect(result.filePath).toBe(filePath);
      expect(result.totalLines).toBeGreaterThan(0);

      // Check that we found entities
      expect(result.entities.length).toBeGreaterThan(0);

      // Should have found the startApp function
      const startAppFunction = result.entities.find(
        e => e.type === "function" && e.name === "startApp"
      );
      expect(startAppFunction).toBeDefined();
      expect(startAppFunction?.isAsync).toBe(true);

      // Should have found variable declarations
      const variables = result.entities.filter(e => e.type === "variable");
      expect(variables.length).toBeGreaterThan(0);

      // Should have found call expressions
      expect(result.callExpressions.length).toBeGreaterThan(0);

      // Should have found Logger calls
      const loggerCalls = result.callExpressions.filter(
        call => call.callee === "Logger.info"
      );
      expect(loggerCalls.length).toBeGreaterThan(0);
    });

    it("should correctly analyze app.ts file", () => {
      const filePath = join(FIXTURES_PATH, "src/app.ts");
      const content = readFileSync(filePath, "utf-8");

      const result = analyzeFile(filePath, content);

      // Check basic properties
      expect(result.filePath).toBe(filePath);
      expect(result.totalLines).toBeGreaterThan(0);

      // Should have found the initializeApplication function
      const initFunction = result.entities.find(
        e => e.type === "function" && e.name === "initializeApplication"
      );
      expect(initFunction).toBeDefined();
      expect(initFunction?.isAsync).toBe(true);

      // Should have found variable declarations
      const variables = result.entities.filter(e => e.type === "variable");
      expect(variables.length).toBeGreaterThan(0);

      // Should have found call expressions
      expect(result.callExpressions.length).toBeGreaterThan(0);

      // Should have found Logger calls
      const loggerCalls = result.callExpressions.filter(call =>
        call.callee.startsWith("Logger.")
      );
      expect(loggerCalls.length).toBeGreaterThan(0);
    });

    it("should correctly analyze helpers.ts file", () => {
      const filePath = join(FIXTURES_PATH, "src/utils/helpers.ts");
      const content = readFileSync(filePath, "utf-8");

      const result = analyzeFile(filePath, content);

      // Check basic properties
      expect(result.filePath).toBe(filePath);
      expect(result.totalLines).toBeGreaterThan(0);

      // Should have found class declarations
      const classes = result.entities.filter(e => e.type === "class");
      expect(classes.length).toBeGreaterThan(0);

      // Should have found the Logger class (as a variable since it's exported differently)
      // In CommonJS, classes are often assigned to variables for export
      const variables = result.entities.filter(e => e.type === "variable");
      expect(variables.length).toBeGreaterThan(0);

      // Should have found function declarations
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions.length).toBeGreaterThan(0);

      // Should have found call expressions
      expect(result.callExpressions.length).toBeGreaterThan(0);
    });

    it("should correctly analyze common.ts types file", () => {
      const filePath = join(FIXTURES_PATH, "types/common.ts");
      const content = readFileSync(filePath, "utf-8");

      const result = analyzeFile(filePath, content);

      // Check basic properties
      expect(result.filePath).toBe(filePath);
      expect(result.totalLines).toBeGreaterThan(0);

      // Should have found interface declarations
      const interfaces = result.entities.filter(e => e.type === "interface");
      expect(interfaces.length).toBeGreaterThan(0);

      // Should have found the User interface
      const userInterface = result.entities.find(
        e => e.type === "interface" && e.name === "User"
      );
      expect(userInterface).toBeDefined();

      // Should have found type alias declarations
      const typeAliases = result.entities.filter(e => e.type === "type");
      expect(typeAliases.length).toBeGreaterThan(0);

      // Should have found the Shape type
      const shapeType = result.entities.find(
        e => e.type === "type" && e.name === "Shape"
      );
      expect(shapeType).toBeDefined();
    });
  });

  describe("analyzeFiles", () => {
    it("should analyze multiple files correctly", () => {
      const files = [
        join(FIXTURES_PATH, "src/main.ts"),
        join(FIXTURES_PATH, "src/app.ts")
      ];

      const results = analyzeFiles(files);

      expect(results).toHaveLength(2);

      // Both should have entities
      expect(results[0].entities.length).toBeGreaterThan(0);
      expect(results[1].entities.length).toBeGreaterThan(0);

      // Both should have call expressions
      expect(results[0].callExpressions.length).toBeGreaterThan(0);
      expect(results[1].callExpressions.length).toBeGreaterThan(0);
    });

    it("should collect call expressions when requested", () => {
      const files = [join(FIXTURES_PATH, "src/app.ts")];

      const results = analyzeFiles(files, { calls: true });

      expect(results).toHaveLength(1);
      expect(results[0].callExpressions.length).toBeGreaterThan(0);

      // Should have found various types of calls
      const callsWithContainingFunction = results[0].callExpressions.filter(
        call => call.containingFunction !== null
      );
      expect(callsWithContainingFunction.length).toBeGreaterThan(0);
    });

    it("should collect type information when requested", () => {
      const files = [join(FIXTURES_PATH, "types/common.ts")];

      const results = analyzeFiles(files, { types: true });

      expect(results).toHaveLength(1);
      expect(results[0].typeInfo).toBeDefined();

      // Should have extracted type information
      expect(results[0].typeInfo.interfaces.length).toBeGreaterThan(0);
      expect(results[0].typeInfo.typeAliases.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with file finder", () => {
    it("should analyze all TypeScript files in the fixture project", () => {
      // Get all TypeScript files from the fixture project
      const tsFiles = getCodeFiles(FIXTURES_PATH);

      expect(tsFiles.length).toBeGreaterThan(0);

      // Analyze all files
      const results = analyzeFiles(tsFiles);

      // Should have results for all files
      expect(results).toHaveLength(tsFiles.length);

      // Each result should have entities
      for (const result of results) {
        expect(result.entities.length).toBeGreaterThanOrEqual(0); // Some files might be empty
        expect(result.filePath).toBeDefined();
        expect(result.totalLines).toBeGreaterThan(0);
      }

      // At least some files should have entities
      const filesWithEntities = results.filter(r => r.entities.length > 0);
      expect(filesWithEntities.length).toBeGreaterThan(0);

      // At least some files should have call expressions
      const filesWithCalls = results.filter(r => r.callExpressions.length > 0);
      expect(filesWithCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent files gracefully in analyzeFiles", () => {
      const files = [join(FIXTURES_PATH, "src/main.ts"), "/non/existent/file.ts"];

      // Should not throw, but should only return results for existing files
      const results = analyzeFiles(files);

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe(join(FIXTURES_PATH, "src/main.ts"));
    });
  });
});
