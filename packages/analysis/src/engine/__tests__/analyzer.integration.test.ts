import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { beforeAll, describe, expect, it } from "vitest";
import type { AnalysisOptions, FileAnalysisResult } from "../../types.js";
import { analyzeFiles } from "../analyzer.js";
import { Logger } from "@sage/utils";

const fixturesPath = join(__dirname, "fixtures");
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

describe("Complex TypeScript Project Analysis (ESM)", () => {
  let esmProjectFiles: { filePath: string; content: string }[];
  let esmAnalysisResults: FileAnalysisResult[];

  beforeAll(() => {
    esmProjectFiles = readAllFixtureFiles("complex-ts-esm-project");
    esmAnalysisResults = analyzeFiles(
      esmProjectFiles.map(f => f.filePath),
      { calls: true, types: true }
    );
    logger.info('ESM Entities', { test: "should correctly analyze entities in ESM project", entities: esmAnalysisResults.flatMap(r => r.entities) });
    logger.info('ESM Calls', { test: "should correctly analyze call expressions in ESM project", calls: esmAnalysisResults.flatMap(r => r.callExpressions) });
    logger.info('ESM TypeInfo', { test: "should correctly analyze type information in ESM project", typeInfo: esmAnalysisResults.map(r => r.typeInfo) });
  });

  it("should correctly analyze entities in ESM project", () => {
    const allEntities = esmAnalysisResults.flatMap(r => r.entities);
    const allTypeInfos = esmAnalysisResults.map(r => r.typeInfo);
    const allInterfaces = allTypeInfos.flatMap(ti => ti.interfaces || []);
    const allTypeAliases = allTypeInfos.flatMap(ti => ti.typeAliases || []);
    const allTypeReferences = allTypeInfos.flatMap(ti => ti.typeReferences || []);

    expect(allEntities.length).toBeGreaterThan(0);

    // Check for specific entities from common.ts, helpers.ts, app.ts, main.ts
    expect(allEntities.some(e => e.name === "User" && e.type === "interface")).toBe(
      true
    );
    expect(
      allEntities.some(e => e.name === "Logger" && e.type === "class")).toBe(
      true
    );
    expect(
      allEntities.some(e => e.name === "idGenerator" && e.type === "function")
    ).toBe(true);
    expect(
      allEntities.some(e => e.name === "SimpleCalculator" && e.type === "class")
    ).toBe(true);
    expect(
      allEntities.some(
        e => e.name === "initializeApplication" && e.type === "function"
      )
    ).toBe(true);
    expect(
      allEntities.some(e => e.name === "startApp" && e.type === "function")
    ).toBe(true);

    // Check for decorators
    expect(
      allEntities.some(e => e.name === "Deprecated" && e.type === "variable")
    ).toBe(true); // Class decorator variable
    expect(
      allEntities.some(e => e.name === "logMethod" && e.type === "variable")
    ).toBe(true); // Method decorator property

    // Check for interfaces
    expect(allInterfaces.some(i => i.name === "Timestamped")).toBe(true);
    expect(allInterfaces.some(i => i.name === "User")).toBe(true);
    expect(allInterfaces.some(i => i.name === "Calculator")).toBe(true);

    // Check for type aliases
    expect(allTypeAliases.some(ta => ta.name === "ID")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MenuItem")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "FeatureFlags")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "GetReturnType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "EventName")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Shape")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "DeepPartial")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ExtractPromiseType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Sum")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "NumberGenerator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MethodDecorator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ClassDecorator")).toBe(true);
});

describe("Complex TypeScript Project Analysis (CJS)", () => {
  let cjsProjectFiles: { filePath: string; content: string }[];
  let cjsAnalysisResults: FileAnalysisResult[];

  beforeAll(() => {
    cjsProjectFiles = readAllFixtureFiles("complex-ts-cjs-project");
    cjsAnalysisResults = analyzeFiles(
      cjsProjectFiles.map(f => f.filePath),
      { calls: true, types: true }
    );
    logger.info('CJS Entities', { test: "should correctly analyze entities in CJS project", entities: cjsAnalysisResults.flatMap(r => r.entities) });
    logger.info('CJS Calls', { test: "should correctly analyze call expressions in CJS project", calls: cjsAnalysisResults.flatMap(r => r.callExpressions) });
    logger.info('CJS TypeInfo', { test: "should correctly analyze type information in CJS project", typeInfo: cjsAnalysisResults.map(r => r.typeInfo) });
  });

  it("should correctly analyze call expressions in ESM project", () => {
    const allCalls = esmAnalysisResults.flatMap(r => r.callExpressions);
    expect(allCalls.length).toBeGreaterThan(0);

    // Calls from app.ts
    expect(
      allCalls.some(
        c =>
          c.callee === "Logger.info" &&
          c.containingFunction === "initializeApplication"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c =>
          c.callee === "idGenerator" &&
          c.containingFunction === "initializeApplication"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c =>
          c.callee === "processUserData" &&
          c.containingFunction === "initializeApplication"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c => c.callee === "SimpleCalculator" && c.type === "function"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c => c.callee === "add" && c.containingFunction === "initializeApplication"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c => c.callee === "sum" && c.containingFunction === "initializeApplication"
      )
    ).toBe(true);
    expect(
      allCalls.some(
        c =>
          c.callee === "safeParseJSON" &&
          c.containingFunction === "initializeApplication"
      )
    ).toBe(true);

    // Calls from main.ts
    expect(
      allCalls.some(
        c =>
          c.callee === "initializeApplication" && c.containingFunction === "startApp"
      )
    ).toBe(true);
  });

  it("should correctly analyze type information in ESM project", () => {
    const allTypeInfos = esmAnalysisResults.map(r => r.typeInfo);
    const allInterfaces = allTypeInfos.flatMap(ti => ti.interfaces || []);
    const allTypeAliases = allTypeInfos.flatMap(ti => ti.typeAliases || []);
    const allTypeReferences = allTypeInfos.flatMap(ti => ti.typeReferences || []);

    // Check for interfaces
    expect(allInterfaces.some(i => i.name === "Timestamped")).toBe(true);
    expect(allInterfaces.some(i => i.name === "User")).toBe(true);
    expect(allInterfaces.some(i => i.name === "Calculator")).toBe(true);

    // Check for type aliases
    expect(allTypeAliases.some(ta => ta.name === "ID")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MenuItem")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "FeatureFlags")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "GetReturnType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "EventName")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Shape")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "DeepPartial")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ExtractPromiseType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Sum")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "NumberGenerator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MethodDecorator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ClassDecorator")).toBe(true);

    // Check for type references (e.g., User, Logger, SimpleCalculator)
    expect(allTypeReferences.some(tr => tr.typeName === "User")).toBe(true);
    expect(allTypeReferences.some(tr => tr.typeName === "Logger")).toBe(true);
    expect(allTypeReferences.some(tr => tr.typeName === "SimpleCalculator")).toBe(
      true
    );
    expect(allTypeReferences.some(tr => tr.typeName === "Generator")).toBe(true);
  });

  it("should correctly parse decorators and generator functions", () => {
    const allEntities = esmAnalysisResults.flatMap(r => r.entities);
    const allCalls = esmAnalysisResults.flatMap(r => r.callExpressions);
    const allTypeInfos = esmAnalysisResults.map(r => r.typeInfo);

    // Check for generator function
    const idGenFn = allEntities.find(
      e => e.name === "idGenerator" && e.type === "function"
    );
    expect(idGenFn).toBeDefined();

    // Check for decorator usage on class and method
    const simpleCalcClass = allEntities.find(
      e => e.name === "SimpleCalculator" && e.type === "class"
    );
    expect(simpleCalcClass).toBeDefined();
    // Decorator application is harder to capture as a direct entity/relationship without deeper AST analysis
    // For now, we rely on the decorator *definition* being parsed as a variable/function

    // Check for type predicate function
    const isCircleFn = allEntities.find(
      e => e.name === "isCircle" && e.type === "function"
    );
    expect(isCircleFn).toBeDefined();
    expect(isCircleFn?.signature).toContain(
      'shape is { kind: "circle"; radius: number }'
    );
  });
});

describe("Complex TypeScript Project Analysis (CJS)", () => {
  let cjsProjectFiles: { filePath: string; content: string }[];
  let cjsAnalysisResults: FileAnalysisResult[];

  beforeAll(() => {
    cjsProjectFiles = readAllFixtureFiles("complex-ts-cjs-project");
    cjsAnalysisResults = analyzeFiles(
      cjsProjectFiles.map(f => f.filePath),
      { calls: true, types: true }
    );
    logger.info('CJS Entities', { test: "should correctly analyze entities in CJS project", entities: cjsAnalysisResults.flatMap(r => r.entities) });
    logger.info('CJS Calls', { test: "should correctly analyze call expressions in CJS project", calls: cjsAnalysisResults.flatMap(r => r.callExpressions) });
    logger.info('CJS TypeInfo', { test: "should correctly analyze type information in CJS project", typeInfo: cjsAnalysisResults.map(r => r.typeInfo) });
  });

  it("should correctly analyze entities in CJS project", () => {
    const allEntities = cjsAnalysisResults.flatMap(r => r.entities);
    const allTypeInfos = cjsAnalysisResults.map(r => r.typeInfo);
    const allInterfaces = allTypeInfos.flatMap(ti => ti.interfaces || []);
    const allTypeAliases = allTypeInfos.flatMap(ti => ti.typeAliases || []);
    const allTypeReferences = allTypeInfos.flatMap(ti => ti.typeReferences || []);

    expect(allEntities.length).toBeGreaterThan(0);

    expect(allInterfaces.some(i => i.name === "User" && i.type === "interface")).toBe(
      true
    );
    expect(
      allEntities.some(e => e.name === "Logger" && e.type === "class")).toBe(
      true
    );
    expect(
      allEntities.some(e => e.name === "idGenerator" && e.type === "function")
    ).toBe(true);
    expect(
      allEntities.some(e => e.name === "SimpleCalculator" && e.type === "class")
    ).toBe(true);
    expect(
      allEntities.some(
        e => e.name === "initializeApplication" && e.type === "function"
      )
    ).toBe(true);
    expect(
      allEntities.some(e => e.name === "startApp" && e.type === "function")
    ).toBe(true);

    // Check for decorators
    expect(
      allEntities.some(e => e.name === "Deprecated" && e.type === "variable")
    ).toBe(true); // Class decorator variable
    expect(
      allEntities.some(e => e.name === "logMethod" && e.type === "variable")
    ).toBe(true); // Method decorator property

    // Check for interfaces
    expect(allInterfaces.some(i => i.name === "Timestamped")).toBe(true);
    expect(allInterfaces.some(i => i.name === "User")).toBe(true);
    expect(allInterfaces.some(i => i.name === "Calculator")).toBe(true);

    // Check for type aliases
    expect(allTypeAliases.some(ta => ta.name === "ID")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MenuItem")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "FeatureFlags")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "GetReturnType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "EventName")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Shape")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "DeepPartial")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ExtractPromiseType")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "Sum")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "NumberGenerator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "MethodDecorator")).toBe(true);
    expect(allTypeAliases.some(ta => ta.name === "ClassDecorator")).toBe(true);

    // Check for type references (e.g., User, Logger, SimpleCalculator)
    expect(allTypeReferences.some(tr => tr.typeName === "User")).toBe(true);
    expect(allTypeReferences.some(tr => tr.typeName === "Logger")).toBe(true);
    expect(allTypeReferences.some(tr => tr.typeName === "SimpleCalculator")).toBe(
      true
    );
    expect(allTypeReferences.some(tr => tr.typeName === "Generator")).toBe(true);

  it("should correctly parse decorators and generator functions", () => {
    const allEntities = cjsAnalysisResults.flatMap(r => r.entities);
    const allCalls = cjsAnalysisResults.flatMap(r => r.callExpressions);
    const allTypeInfos = cjsAnalysisResults.map(r => r.typeInfo);

    // Check for generator function
    const idGenFn = allEntities.find(
      e => e.name === "idGenerator" && e.type === "function"
    );
    expect(idGenFn).toBeDefined();

    // Check for decorator usage on class and method
    const simpleCalcClass = allEntities.find(
      e => e.name === "SimpleCalculator" && e.type === "class"
    );
    expect(simpleCalcClass).toBeDefined();
    // Decorator application is harder to capture as a direct entity/relationship without deeper AST analysis
    // For now, we rely on the decorator *definition* being parsed as a variable/function

    // Check for type predicate function
    const isCircleFn = allEntities.find(
      e => e.name === "isCircle" && e.type === "function"
    );
    expect(isCircleFn).toBeDefined();
    expect(isCircleFn?.signature).toContain(
      'shape is { kind: "circle"; radius: number }'
    );
  });
});
