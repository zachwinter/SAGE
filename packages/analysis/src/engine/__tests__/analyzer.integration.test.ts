import { Logger } from "@sage/utils";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { AnalysisOptions } from "../../types.js";
import { analyzeFiles } from "../analyzer.js";

const fixturesPath = join(__dirname, "fixtures");

// Enhanced logging for better test debugging
const testLogger = (message: string) => {
  if (process.env.NODE_ENV === 'test' && process.env.DEBUG_TESTS) {
    logger.debug(`Integration Test: ${message}`);
  }
};
const logger = new Logger("AnalyzerIntegrationTests", "analysis-debug.log");

describe("Multiple file analysis", () => {
  it("should analyze multiple files of different types", () => {
    const files = [
      join(fixturesPath, "sample.ts"),
      join(fixturesPath, "calls.ts"),
      join(fixturesPath, "sample.rs")
    ];
    const options: AnalysisOptions = { calls: true };

    const results = analyzeFiles(files, options);

    // Enhanced validation for multi-file analysis
    expect(results.length).toBe(3);
    expect(Array.isArray(results)).toBe(true);

    // Comprehensive file path validation
    expect(results.map(r => r.filePath)).toEqual(expect.arrayContaining(files));
    results.forEach((result, index) => {
      expect(result.filePath).toBe(files[index]);
      expect(typeof result.filePath).toBe('string');
      expect(result.filePath.length).toBeGreaterThan(0);
    });

    // Enhanced entity validation with data quality checks
    results.forEach(result => {
      expect(result.entities.length).toBeGreaterThan(0);
      expect(Array.isArray(result.entities)).toBe(true);
      
      // Validate entity structure for each found entity
      result.entities.forEach(entity => {
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('line');
        expect(entity).toHaveProperty('signature');
        expect(typeof entity.type).toBe('string');
        expect(typeof entity.name).toBe('string');
        expect(typeof entity.line).toBe('number');
        expect(entity.line).toBeGreaterThan(0);
      });
    });

    // Enhanced call expression validation for TypeScript files
    const tsResults = results.filter(r => r.filePath.endsWith(".ts"));
    expect(tsResults.length).toBeGreaterThanOrEqual(2);
    
    tsResults.forEach(result => {
      expect(Array.isArray(result.callExpressions)).toBe(true);
      // Validate call expression structure if any exist
      result.callExpressions.forEach(call => {
        expect(call).toHaveProperty('callee');
        expect(call).toHaveProperty('type');
        expect(call).toHaveProperty('line');
        expect(typeof call.callee).toBe('string');
        expect(typeof call.type).toBe('string');
        expect(typeof call.line).toBe('number');
      });
      
      // Validate other required properties
      expect(result).toHaveProperty('totalLines');
      expect(result).toHaveProperty('typeInfo');
      expect(typeof result.totalLines).toBe('number');
      expect(result.totalLines).toBeGreaterThan(0);
      expect(typeof result.typeInfo).toBe('object');
    });
    
    // Validate Rust file handling (should have different structure)
    const rustResults = results.filter(r => r.filePath.endsWith(".rs"));
    if (rustResults.length > 0) {
      rustResults.forEach(result => {
        expect(result).toHaveProperty('entities');
        expect(result).toHaveProperty('callExpressions');
        expect(Array.isArray(result.entities)).toBe(true);
        expect(Array.isArray(result.callExpressions)).toBe(true);
      });
    }
  });

  it("should return analysis for all files, even those with no entities", () => {
    const files = [
      join(fixturesPath, "sample.ts"), // has many entities
      join(fixturesPath, "malformed.js") // may have few/no entities
    ];
    const options: AnalysisOptions = {}; // no calls or types

    const results = analyzeFiles(files, options);

    // Enhanced validation for mixed file analysis
    expect(results.length).toBe(2);
    expect(Array.isArray(results)).toBe(true);

    // Comprehensive sample file validation
    const sampleResult = results.find(r => r.filePath.endsWith("sample.ts"));
    expect(sampleResult).toBeDefined();
    expect(sampleResult?.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(sampleResult?.entities)).toBe(true);
    
    // Validate sample file structure completeness
    if (sampleResult) {
      expect(sampleResult).toMatchObject({
        filePath: expect.stringContaining('sample.ts'),
        totalLines: expect.any(Number),
        typeInfo: expect.any(Object)
      });
      expect(sampleResult.totalLines).toBeGreaterThan(0);
      expect(Array.isArray(sampleResult.callExpressions)).toBe(true);
      
      // Validate entity data quality
      sampleResult.entities.forEach(entity => {
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('line');
        expect(entity.name.trim().length).toBeGreaterThan(0);
      });
    }

    // Enhanced malformed file validation
    const malformedResult = results.find(r => r.filePath.endsWith("malformed.js"));
    expect(malformedResult).toBeDefined();
    expect(Array.isArray(malformedResult?.entities)).toBe(true);
    
    if (malformedResult) {
      expect(malformedResult).toMatchObject({
        filePath: expect.stringContaining('malformed.js'),
        entities: expect.any(Array),
        callExpressions: expect.any(Array),
        typeInfo: expect.any(Object),
        totalLines: expect.any(Number)
      });
      expect(malformedResult.totalLines).toBeGreaterThan(0);
      
      // Even malformed files should have valid structure
      malformedResult.entities.forEach(entity => {
        expect(typeof entity.type).toBe('string');
        expect(typeof entity.name).toBe('string');
        expect(typeof entity.line).toBe('number');
      });
    }
    
    // Validate that all files were processed (no skips due to errors)
    const processedPaths = results.map(r => r.filePath);
    expect(processedPaths).toHaveLength(files.length);
    files.forEach(filePath => {
      expect(processedPaths).toContain(filePath);
    });
  });
});

// Helper to read all files from a fixture directory
function readAllFixtureFiles(
  fixtureName: string
): { filePath: string; content: string }[] {
  const dirPath = join(fixturesPath, fixtureName);
  const files: { filePath: string; content: string }[] = [];

  function walkSync(currentPath: string) {
    readdirSync(currentPath).forEach(name => {
      const filePath = join(currentPath, name);
      const stat = statSync(filePath);
      if (stat.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
        files.push({ filePath, content: readFileSync(filePath, "utf8") });
      } else if (stat.isDirectory()) {
        walkSync(filePath);
      }
    });
  }

  walkSync(dirPath);
  return files;
}

// Additional comprehensive integration tests
describe("Integration test scenarios with enhanced validation", () => {
  it("should handle mixed file types with comprehensive validation", () => {
    const mixedFiles = [
      join(fixturesPath, "sample.ts"),
      join(fixturesPath, "calls.ts")
    ];
    const options: AnalysisOptions = { calls: true, types: true };
    
    const results = analyzeFiles(mixedFiles, options);
    
    expect(results).toHaveLength(2);
    
    // Validate comprehensive analysis results
    results.forEach(result => {
      // Basic structure validation
      expect(result).toMatchObject({
        filePath: expect.any(String),
        entities: expect.any(Array),
        callExpressions: expect.any(Array),
        typeInfo: expect.any(Object),
        totalLines: expect.any(Number)
      });
      
      // Quality validation
      expect(result.filePath.length).toBeGreaterThan(0);
      expect(result.totalLines).toBeGreaterThan(0);
      
      // TypeScript-specific validation
      if (result.filePath.endsWith('.ts')) {
        expect(result).toHaveProperty('sourceFile');
        // Should have extracted type info when requested
        expect(result.typeInfo).toBeDefined();
        expect(typeof result.typeInfo).toBe('object');
      }
    });
  });
  
  it("should provide consistent results across multiple runs", () => {
    const files = [join(fixturesPath, "sample.ts")];
    const options: AnalysisOptions = { calls: true };
    
    const firstRun = analyzeFiles(files, options);
    const secondRun = analyzeFiles(files, options);
    
    expect(firstRun).toHaveLength(secondRun.length);
    expect(firstRun[0].filePath).toBe(secondRun[0].filePath);
    expect(firstRun[0].entities.length).toBe(secondRun[0].entities.length);
    expect(firstRun[0].totalLines).toBe(secondRun[0].totalLines);
    
    // Verify entity names are consistent
    const firstNames = firstRun[0].entities.map(e => e.name).sort();
    const secondNames = secondRun[0].entities.map(e => e.name).sort();
    expect(firstNames).toEqual(secondNames);
  });
  
  it("should handle performance with reasonable execution time", () => {
    const files = [join(fixturesPath, "sample.ts")];
    const options: AnalysisOptions = {};
    
    const startTime = Date.now();
    const results = analyzeFiles(files, options);
    const executionTime = Date.now() - startTime;
    
    // Analysis should complete in reasonable time (< 5 seconds for test files)
    expect(executionTime).toBeLessThan(5000);
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('entities');
  });
});
