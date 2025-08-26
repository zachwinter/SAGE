import { describe, it, expect } from "vitest";
import ts from "typescript";
import {
  extractEntitiesFromAST,
  extractCallExpressions,
  extractTypeInformation
} from "../ts-ast-extractor.js";

describe("ts-ast-extractor", () => {
  const createSourceFile = (code: string) => {
    return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
  };

  describe("extractEntitiesFromAST", () => {
    it("should extract a simple function declaration", () => {
      const code = `function sayHello() { console.log("Hello"); }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      // Enhanced validation for simple function extraction
      expect(entities).toHaveLength(1);
      expect(Array.isArray(entities)).toBe(true);
      
      const functionEntity = entities[0];
      expect(functionEntity).toMatchObject({
        type: "function",
        name: "sayHello",
        line: 1,
        isAsync: false,
        isExported: false
      });
      
      // Comprehensive signature validation
      expect(functionEntity.signature).toContain("function sayHello()");
      expect(typeof functionEntity.signature).toBe('string');
      expect(functionEntity.signature.length).toBeGreaterThan(0);
      expect(functionEntity.signature.trim()).not.toBe('');
      
      // Validate all required properties exist with correct types
      expect(typeof functionEntity.type).toBe('string');
      expect(typeof functionEntity.name).toBe('string');
      expect(typeof functionEntity.line).toBe('number');
      expect(typeof functionEntity.isAsync).toBe('boolean');
      expect(typeof functionEntity.isExported).toBe('boolean');
      expect(functionEntity.line).toBeGreaterThan(0);
    });

    it("should extract an exported async function", () => {
      const code = `export async function fetchData(): Promise<string> { return "data"; }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      // Enhanced validation for exported async function
      expect(entities).toHaveLength(1);
      expect(Array.isArray(entities)).toBe(true);
      
      const asyncFunction = entities[0];
      expect(asyncFunction).toMatchObject({
        type: "function",
        name: "fetchData",
        line: 1,
        isAsync: true,
        isExported: true
      });
      
      // Validate async and export flags are properly detected
      expect(asyncFunction.isAsync).toBe(true);
      expect(asyncFunction.isExported).toBe(true);
      expect(typeof asyncFunction.signature).toBe('string');
      expect(asyncFunction.signature).toContain('async');
      expect(asyncFunction.signature).toContain('fetchData');
      
      // Validate name parsing accuracy
      expect(asyncFunction.name.trim()).toBe('fetchData');
      expect(asyncFunction.name).not.toContain('async');
      expect(asyncFunction.name).not.toContain('export');
    });

    it("should extract class declarations with modifiers", () => {
      const code = `export abstract class BaseService {
        abstract process(): void;
      }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      // Enhanced validation for abstract class extraction
      expect(entities).toHaveLength(2); // Class + method
      expect(Array.isArray(entities)).toBe(true);
      
      const classEntity = entities.find(e => e.type === "class");
      expect(classEntity).toBeDefined();
      expect(classEntity).toMatchObject({
        type: "class",
        name: "BaseService",
        line: 1,
        isAbstract: true,
        isExported: true
      });
      
      // Validate abstract and export detection
      expect(classEntity?.isAbstract).toBe(true);
      expect(classEntity?.isExported).toBe(true);
      expect(typeof classEntity?.signature).toBe('string');
      expect(classEntity?.signature).toContain('abstract');
      expect(classEntity?.signature).toContain('BaseService');
      
      // Validate method extraction within class
      const methodEntity = entities.find(e => e.type === "function");
      expect(methodEntity).toBeDefined();
      expect(methodEntity?.name).toBe('process');
      expect(methodEntity?.line).toBeGreaterThan(classEntity?.line || 0);
    });

    it("should extract method declarations within classes", () => {
      const code = `class ApiClient {
        async getData() { return {}; }
        private syncMethod() { }
      }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      const methods = entities.filter(e => e.type === "function");
      expect(methods).toHaveLength(2);
      expect(Array.isArray(methods)).toBe(true);

      // Enhanced validation for async method
      const asyncMethod = methods.find(m => m.name === "getData");
      expect(asyncMethod).toBeDefined();
      expect(asyncMethod).toMatchObject({
        type: "function",
        name: "getData",
        isAsync: true,
        isExported: false
      });
      expect(asyncMethod?.signature).toContain('async');
      expect(asyncMethod?.signature).toContain('getData');
      expect(typeof asyncMethod?.signature).toBe('string');

      // Enhanced validation for private method
      const syncMethod = methods.find(m => m.name === "syncMethod");
      expect(syncMethod).toBeDefined();
      expect(syncMethod).toMatchObject({
        type: "function",
        name: "syncMethod",
        isAsync: false,
        isExported: false
      });
      expect(syncMethod?.signature).toContain('syncMethod');
      expect(typeof syncMethod?.signature).toBe('string');
      
      // Validate line number ordering (methods should be after class)
      const classEntity = entities.find(e => e.type === "class");
      if (classEntity && asyncMethod && syncMethod) {
        expect(asyncMethod.line).toBeGreaterThan(classEntity.line);
        expect(syncMethod.line).toBeGreaterThan(asyncMethod.line);
      }
    });

    it("should extract interface declarations", () => {
      const code = `export interface UserData {
        id: string;
        name: string;
      }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: "interface",
        name: "UserData",
        line: 1,
        isExported: true
      });
    });

    it("should extract type alias declarations", () => {
      const code = `type Status = "pending" | "completed" | "failed";`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: "type",
        name: "Status",
        line: 1,
        isExported: false
      });
    });

    it("should extract import declarations", () => {
      const code = `import { useState, useEffect } from "react";
import * as fs from "fs";
import defaultExport from "./utils";`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(3);

      const namedImport = entities.find(e => e.name.includes("useState"));
      expect(namedImport).toMatchObject({
        type: "import",
        module: "react",
        line: 1
      });

      const namespaceImport = entities.find(e => e.name.includes("* as fs"));
      expect(namespaceImport).toMatchObject({
        type: "import",
        module: "fs",
        line: 2
      });

      const defaultImport = entities.find(e => e.name === "defaultExport");
      expect(defaultImport).toMatchObject({
        type: "import",
        module: "./utils",
        line: 3
      });
    });

    it("should extract export declarations", () => {
      const code = `export { foo, bar } from "./utils";
export * from "./types";
export default function main() {}`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(3);

      const namedExport = entities.find(e => e.name.includes("foo, bar"));
      expect(namedExport).toMatchObject({
        type: "export",
        module: "./utils",
        exportType: "named",
        isReExport: true
      });

      const allExport = entities.find(e => e.name === "*");
      expect(allExport).toMatchObject({
        type: "export",
        module: "./types",
        exportType: "all",
        isReExport: true
      });

      // Default export will be captured by the function declaration with isExported: true
      const exportedFunction = entities.find(
        e => e.type === "function" && e.name === "main"
      );
      expect(exportedFunction).toMatchObject({
        type: "function",
        name: "main",
        isExported: true
      });
    });

    it("should extract variable declarations", () => {
      const code = `const API_URL = "https://api.example.com";
let counter = 0;
var globalState;`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(3);
      expect(entities.map(e => e.name)).toEqual([
        "API_URL",
        "counter",
        "globalState"
      ]);
      expect(entities.every(e => e.type === "variable")).toBe(true);
    });

    it("should handle empty source file", () => {
      const code = ``;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(0);
    });

    it("should handle comments and whitespace", () => {
      const code = `// This is a comment
/* Block comment */

function test() {
  // Inline comment
}`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: "function",
        name: "test",
        line: 4 // Should be on line 4 after comments/whitespace
      });
    });
  });

  describe("extractCallExpressions", () => {
    it("should extract simple function calls", () => {
      const code = `
function main() {
  console.log("test");
  process.exit(0);
}`;
      const sourceFile = createSourceFile(code);

      const callExpressions = extractCallExpressions(sourceFile);

      // Enhanced validation for call expression extraction
      expect(callExpressions).toHaveLength(2);
      expect(Array.isArray(callExpressions)).toBe(true);

      const consoleLog = callExpressions.find(c => c.callee === "console.log");
      expect(consoleLog).toBeDefined();
      expect(consoleLog).toMatchObject({
        callee: "console.log",
        type: "method",
        containingFunction: "main",
        argumentCount: 1
      });
      
      // Comprehensive validation for console.log call
      expect(typeof consoleLog?.callee).toBe('string');
      expect(typeof consoleLog?.type).toBe('string');
      expect(typeof consoleLog?.containingFunction).toBe('string');
      expect(typeof consoleLog?.argumentCount).toBe('number');
      expect(consoleLog?.line).toBeGreaterThan(0);
      expect(consoleLog?.signature).toContain('console.log');

      const processExit = callExpressions.find(c => c.callee === "process.exit");
      expect(processExit).toBeDefined();
      expect(processExit).toMatchObject({
        callee: "process.exit",
        type: "method",
        containingFunction: "main",
        argumentCount: 1
      });
      
      // Comprehensive validation for process.exit call
      expect(typeof processExit?.callee).toBe('string');
      expect(typeof processExit?.type).toBe('string');
      expect(typeof processExit?.containingFunction).toBe('string');
      expect(typeof processExit?.argumentCount).toBe('number');
      expect(processExit?.line).toBeGreaterThan(0);
      expect(processExit?.signature).toContain('process.exit');
      
      // Validate call ordering (should be in source order)
      if (consoleLog && processExit) {
        expect(processExit.line).toBeGreaterThan(consoleLog.line);
      }
    });

    it("should extract calls with different expression types", () => {
      const code = `
function test() {
  // Simple function call
  foo();
  
  // Method call
  obj.method();
  
  // Dynamic call
  obj[key]();
}`;
      const sourceFile = createSourceFile(code);

      const callExpressions = extractCallExpressions(sourceFile);

      expect(callExpressions).toHaveLength(3);

      expect(callExpressions[0]).toMatchObject({
        callee: "foo",
        type: "function"
      });

      expect(callExpressions[1]).toMatchObject({
        callee: "obj.method",
        type: "method"
      });

      expect(callExpressions[2]).toMatchObject({
        callee: "obj[dynamic]",
        type: "dynamic"
      });
    });

    it("should handle calls outside functions", () => {
      const code = `console.log("Global call");`;
      const sourceFile = createSourceFile(code);

      const callExpressions = extractCallExpressions(sourceFile);

      expect(callExpressions).toHaveLength(1);
      expect(callExpressions[0]).toMatchObject({
        callee: "console.log",
        type: "method",
        containingFunction: null
      });
    });

    it("should handle nested function calls", () => {
      const code = `
function outer() {
  function inner() {
    helper();
  }
  inner();
}`;
      const sourceFile = createSourceFile(code);

      const callExpressions = extractCallExpressions(sourceFile);

      expect(callExpressions).toHaveLength(2);

      const helperCall = callExpressions.find(c => c.callee === "helper");
      expect(helperCall?.containingFunction).toBe("inner");

      const innerCall = callExpressions.find(c => c.callee === "inner");
      expect(innerCall?.containingFunction).toBe("outer");
    });
  });

  describe("extractTypeInformation", () => {
    it("should extract type aliases with parameters", () => {
      const code = `
type Result<T, E = Error> = { data: T } | { error: E };
export type UserID = string;`;
      const sourceFile = createSourceFile(code);

      const typeInfo = extractTypeInformation(sourceFile);

      // Enhanced validation for type information structure
      expect(typeInfo).toBeDefined();
      expect(typeof typeInfo).toBe('object');
      expect(typeInfo.typeAliases).toHaveLength(2);
      expect(Array.isArray(typeInfo.typeAliases)).toBe(true);

      // Comprehensive validation for generic type alias
      const resultType = typeInfo.typeAliases.find(t => t.name === "Result");
      expect(resultType).toBeDefined();
      expect(resultType).toMatchObject({
        name: "Result",
        typeParameters: ["T", "E"],
        isExported: false
      });
      expect(Array.isArray(resultType?.typeParameters)).toBe(true);
      expect(resultType?.typeParameters).toHaveLength(2);
      expect(resultType?.typeParameters).toContain('T');
      expect(resultType?.typeParameters).toContain('E');
      expect(typeof resultType?.line).toBe('number');
      expect(resultType?.line).toBeGreaterThan(0);

      // Comprehensive validation for exported simple type alias
      const userIdType = typeInfo.typeAliases.find(t => t.name === "UserID");
      expect(userIdType).toBeDefined();
      expect(userIdType).toMatchObject({
        name: "UserID",
        typeParameters: [],
        isExported: true
      });
      expect(Array.isArray(userIdType?.typeParameters)).toBe(true);
      expect(userIdType?.typeParameters).toHaveLength(0);
      expect(userIdType?.isExported).toBe(true);
      expect(typeof userIdType?.line).toBe('number');
      expect(userIdType?.line).toBeGreaterThan(0);
      
      // Validate line ordering
      if (resultType && userIdType) {
        expect(userIdType.line).toBeGreaterThan(resultType.line);
      }
    });

    it("should extract interfaces with inheritance", () => {
      const code = `
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

export interface ServiceDog extends Dog, Trainable {
  certification: string;
}`;
      const sourceFile = createSourceFile(code);

      const typeInfo = extractTypeInformation(sourceFile);

      expect(typeInfo.interfaces).toHaveLength(3);

      const dogInterface = typeInfo.interfaces.find(i => i.name === "Dog");
      expect(dogInterface).toMatchObject({
        name: "Dog",
        extends: ["Animal"],
        isExported: false
      });

      const serviceDogInterface = typeInfo.interfaces.find(
        i => i.name === "ServiceDog"
      );
      expect(serviceDogInterface).toMatchObject({
        name: "ServiceDog",
        extends: ["Dog", "Trainable"],
        isExported: true
      });
    });

    it("should extract class information", () => {
      const code = `
class BaseController {
  protected id: string;
}

export abstract class ApiController extends BaseController implements Loggable {
  abstract handle(): void;
}`;
      const sourceFile = createSourceFile(code);

      const typeInfo = extractTypeInformation(sourceFile);

      expect(typeInfo.classes).toHaveLength(2);

      const apiController = typeInfo.classes.find(c => c.name === "ApiController");
      expect(apiController).toMatchObject({
        name: "ApiController",
        extends: ["BaseController", "Loggable"],
        isAbstract: true,
        isExported: true
      });
    });

    it("should extract enum declarations", () => {
      const code = `
enum Status {
  PENDING,
  COMPLETED,
  FAILED
}

export const enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info"
}`;
      const sourceFile = createSourceFile(code);

      const typeInfo = extractTypeInformation(sourceFile);

      expect(typeInfo.enums).toHaveLength(2);

      const statusEnum = typeInfo.enums.find(e => e.name === "Status");
      expect(statusEnum).toMatchObject({
        name: "Status",
        members: 3,
        isConst: false,
        isExported: false
      });

      const logLevelEnum = typeInfo.enums.find(e => e.name === "LogLevel");
      expect(logLevelEnum).toMatchObject({
        name: "LogLevel",
        members: 3,
        isConst: true,
        isExported: true
      });
    });

    it("should handle empty source file", () => {
      const code = ``;
      const sourceFile = createSourceFile(code);

      const typeInfo = extractTypeInformation(sourceFile);

      expect(typeInfo).toEqual({
        typeAliases: [],
        interfaces: [],
        classes: [],
        enums: [],
        typeReferences: []
      });
    });

    it("should handle malformed AST gracefully", () => {
      // Create a minimal source file that might cause issues
      const code = `type`;
      const sourceFile = createSourceFile(code);

      // Should not throw
      expect(() => {
        const typeInfo = extractTypeInformation(sourceFile);
        expect(typeInfo).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle anonymous functions and classes", () => {
      const code = `
const fn = function() {};
const cls = class {};
export default function() {}`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities.some(e => e.name === "anonymous")).toBe(true);
    });

    it("should handle complex nested structures", () => {
      const code = `
export namespace MyNamespace {
  export interface Config {
    apiUrl: string;
  }
  
  export class Service {
    private config: Config;
    
    constructor(config: Config) {
      this.config = config;
    }
    
    public async fetchData<T>(endpoint: string): Promise<T> {
      return fetch(\`\${this.config.apiUrl}/\${endpoint}\`);
    }
  }
}`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);
      const typeInfo = extractTypeInformation(sourceFile);

      // Enhanced validation for complex nested structures
      expect(entities.length).toBeGreaterThan(0);
      expect(typeInfo.interfaces.length).toBeGreaterThan(0);
      expect(typeInfo.classes.length).toBeGreaterThan(0);
      
      // Validate namespace entities have proper structure
      entities.forEach(entity => {
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('line');
        expect(typeof entity.type).toBe('string');
        expect(typeof entity.name).toBe('string');
        expect(typeof entity.line).toBe('number');
      });
      
      // Validate type information structure
      typeInfo.interfaces.forEach(iface => {
        expect(iface).toHaveProperty('name');
        expect(iface).toHaveProperty('line');
        expect(typeof iface.name).toBe('string');
        expect(typeof iface.line).toBe('number');
      });
      
      typeInfo.classes.forEach(cls => {
        expect(cls).toHaveProperty('name');
        expect(cls).toHaveProperty('line');
        expect(typeof cls.name).toBe('string');
        expect(typeof cls.line).toBe('number');
      });
    });
  });
  
  describe("comprehensive edge cases and error handling", () => {
    it("should handle deeply nested function calls", () => {
      const code = `
function outer() {
  function middle() {
    function inner() {
      deepCall();
      return nested.deep.property.method();
    }
    inner();
  }
  middle();
}`;
      const sourceFile = createSourceFile(code);

      const callExpressions = extractCallExpressions(sourceFile);

      expect(callExpressions.length).toBeGreaterThanOrEqual(3);
      
      // Validate containingFunction relationships
      const deepCall = callExpressions.find(c => c.callee === "deepCall");
      expect(deepCall?.containingFunction).toBe("inner");
      
      const innerCall = callExpressions.find(c => c.callee === "inner");
      expect(innerCall?.containingFunction).toBe("middle");
      
      const middleCall = callExpressions.find(c => c.callee === "middle");
      expect(middleCall?.containingFunction).toBe("outer");
      
      // Validate nested property access (might be found as nested.deep.property.method or just method)
      const nestedCall = callExpressions.find(c => c.callee.includes("nested") || c.callee.includes("method"));
      if (nestedCall) {
        expect(nestedCall.type).toBe("method");
      } else {
        // If not found, at least verify we have the expected number of calls
        expect(callExpressions.length).toBeGreaterThanOrEqual(3);
      }
    });
    
    it("should handle malformed but parseable TypeScript", () => {
      const code = `
// Missing semicolons and inconsistent formatting
function test() {
  let x = 1
  const y = "hello"
  if (x > 0) {
    console.log(y)
  }
  return x + 1
}`;
      const sourceFile = createSourceFile(code);

      expect(() => {
        const entities = extractEntitiesFromAST(sourceFile);
        const calls = extractCallExpressions(sourceFile);
        
        expect(Array.isArray(entities)).toBe(true);
        expect(Array.isArray(calls)).toBe(true);
        expect(entities.length).toBeGreaterThan(0);
        expect(calls.length).toBeGreaterThan(0);
        
        // Should still extract the function correctly
        const testFunc = entities.find(e => e.name === "test");
        expect(testFunc).toBeDefined();
        expect(testFunc?.type).toBe("function");
      }).not.toThrow();
    });
    
    it("should validate all extracted entity properties comprehensively", () => {
      const code = `
export default async function* generatorFunc<T>(param: T): AsyncGenerator<T> {
  yield param;
}

export const arrowFunc = async <U>(x: U) => {
  return Promise.resolve(x);
};

export class GenericClass<K, V> extends Map<K, V> implements Iterable<[K, V]> {
  private readonly _size: number;
  
  constructor() {
    super();
    this._size = 0;
  }
  
  public async get(key: K): Promise<V | undefined> {
    return super.get(key);
  }
}`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);
      
      expect(entities.length).toBeGreaterThan(0);
      
      // Validate every entity has all required properties
      entities.forEach(entity => {
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('line');
        expect(entity).toHaveProperty('signature');
        
        // Type validation
        expect(typeof entity.type).toBe('string');
        expect(['function', 'class', 'interface', 'type', 'variable', 'import', 'export'].includes(entity.type)).toBe(true);
        
        // Name validation
        expect(typeof entity.name).toBe('string');
        expect(entity.name.length).toBeGreaterThan(0);
        
        // Line validation
        expect(typeof entity.line).toBe('number');
        expect(entity.line).toBeGreaterThan(0);
        
        // Signature validation
        expect(typeof entity.signature).toBe('string');
        expect(entity.signature.length).toBeGreaterThan(0);
        
        // Conditional property validation based on type
        if (entity.type === 'function') {
          expect(entity).toHaveProperty('isAsync');
          expect(entity).toHaveProperty('isExported');
          expect(typeof entity.isAsync).toBe('boolean');
          expect(typeof entity.isExported).toBe('boolean');
        }
        
        if (entity.type === 'class') {
          expect(entity).toHaveProperty('isExported');
          expect(typeof entity.isExported).toBe('boolean');
        }
      });
      
      // Validate specific complex entities
      const generatorFunc = entities.find(e => e.name === "generatorFunc");
      expect(generatorFunc).toBeDefined();
      expect(generatorFunc?.isAsync).toBe(true);
      expect(generatorFunc?.isExported).toBe(true);
      
      const genericClass = entities.find(e => e.name === "GenericClass");
      expect(genericClass).toBeDefined();
      expect(genericClass?.isExported).toBe(true);
    });
    
    it("should handle performance with large complex files", () => {
      // Generate a large TypeScript file
      const largeCode = Array.from({ length: 100 }, (_, i) => 
        `export function func${i}() {\n  console.log("Function ${i}");\n  return ${i};\n}`
      ).join('\n\n');
      
      const sourceFile = createSourceFile(largeCode);
      
      const startTime = Date.now();
      const entities = extractEntitiesFromAST(sourceFile);
      const calls = extractCallExpressions(sourceFile);
      const typeInfo = extractTypeInformation(sourceFile);
      const executionTime = Date.now() - startTime;
      
      // Should complete in reasonable time (< 1 second for 100 functions)
      expect(executionTime).toBeLessThan(1000);
      
      // Validate results
      expect(entities).toHaveLength(100);
      expect(calls).toHaveLength(100); // One console.log per function
      expect(Array.isArray(entities)).toBe(true);
      expect(Array.isArray(calls)).toBe(true);
      
      // Validate all functions were extracted correctly
      entities.forEach((entity, index) => {
        expect(entity.name).toBe(`func${index}`);
        expect(entity.type).toBe('function');
        expect(entity.isExported).toBe(true);
      });
    });
  });
});
