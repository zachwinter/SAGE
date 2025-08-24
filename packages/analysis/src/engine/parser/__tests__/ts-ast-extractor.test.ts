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

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: "function",
        name: "sayHello",
        line: 1,
        isAsync: false,
        isExported: false
      });
      expect(entities[0].signature).toContain("function sayHello()");
    });

    it("should extract an exported async function", () => {
      const code = `export async function fetchData(): Promise<string> { return "data"; }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: "function",
        name: "fetchData",
        line: 1,
        isAsync: true,
        isExported: true
      });
    });

    it("should extract class declarations with modifiers", () => {
      const code = `export abstract class BaseService {
        abstract process(): void;
      }`;
      const sourceFile = createSourceFile(code);

      const entities = extractEntitiesFromAST(sourceFile);

      expect(entities).toHaveLength(2); // Class + method
      const classEntity = entities.find(e => e.type === "class");
      expect(classEntity).toMatchObject({
        type: "class",
        name: "BaseService",
        line: 1,
        isAbstract: true,
        isExported: true
      });
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

      const asyncMethod = methods.find(m => m.name === "getData");
      expect(asyncMethod).toMatchObject({
        type: "function",
        name: "getData",
        isAsync: true,
        isExported: false
      });

      const syncMethod = methods.find(m => m.name === "syncMethod");
      expect(syncMethod).toMatchObject({
        type: "function",
        name: "syncMethod",
        isAsync: false,
        isExported: false
      });
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

      expect(callExpressions).toHaveLength(2);

      const consoleLog = callExpressions.find(c => c.callee === "console.log");
      expect(consoleLog).toMatchObject({
        callee: "console.log",
        type: "method",
        containingFunction: "main",
        argumentCount: 1
      });

      const processExit = callExpressions.find(c => c.callee === "process.exit");
      expect(processExit).toMatchObject({
        callee: "process.exit",
        type: "method",
        containingFunction: "main",
        argumentCount: 1
      });
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

      expect(typeInfo.typeAliases).toHaveLength(2);

      const resultType = typeInfo.typeAliases.find(t => t.name === "Result");
      expect(resultType).toMatchObject({
        name: "Result",
        typeParameters: ["T", "E"],
        isExported: false
      });

      const userIdType = typeInfo.typeAliases.find(t => t.name === "UserID");
      expect(userIdType).toMatchObject({
        name: "UserID",
        typeParameters: [],
        isExported: true
      });
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

      // Should extract entities from within the namespace
      expect(entities.length).toBeGreaterThan(0);
      expect(typeInfo.interfaces.length).toBeGreaterThan(0);
      expect(typeInfo.classes.length).toBeGreaterThan(0);
    });
  });
});
