import { describe, it, expect } from "vitest";
import { analyzeFileBasic } from "../basic-js-parser.js";

describe("basic-js-parser", () => {
  describe("analyzeFileBasic", () => {
    it("should extract function declarations", () => {
      const code = `function testFunction() {
  return true;
}

export async function asyncFunc() {
  return Promise.resolve();
}`;

      const result = analyzeFileBasic("test.js", code);

      expect(result.entities).toHaveLength(2);

      const normalFunc = result.entities.find(e => e.name === "testFunction");
      expect(normalFunc).toMatchObject({
        type: "function",
        name: "testFunction",
        line: 1,
        signature: "function testFunction() {"
      });

      const asyncFunc = result.entities.find(e => e.name === "asyncFunc");
      expect(asyncFunc).toMatchObject({
        type: "function",
        name: "asyncFunc",
        line: 5,
        signature: "export async function asyncFunc() {"
      });
    });

    it("should extract arrow functions", () => {
      const code = `const arrowFunc = () => {};
export const asyncArrow = async (param) => {
  return param;
};
let varArrow = function() {};`;

      const result = analyzeFileBasic("test.js", code);

      // The regex only matches const/let/var followed by =, not function expressions
      expect(result.entities).toHaveLength(2);

      const arrow1 = result.entities.find(e => e.name === "arrowFunc");
      expect(arrow1).toMatchObject({
        type: "function",
        name: "arrowFunc",
        line: 1
      });

      const arrow2 = result.entities.find(e => e.name === "asyncArrow");
      expect(arrow2).toMatchObject({
        type: "function",
        name: "asyncArrow",
        line: 2
      });

      // varArrow = function() {} doesn't match the arrow function regex
      const arrow3 = result.entities.find(e => e.name === "varArrow");
      expect(arrow3).toBeUndefined();
    });

    it("should extract class declarations", () => {
      const code = `class MyClass {
  constructor() {}
}

export abstract class BaseClass {
  abstract method();
}`;

      const result = analyzeFileBasic("test.js", code);

      expect(result.entities).toHaveLength(2);

      const normalClass = result.entities.find(e => e.name === "MyClass");
      expect(normalClass).toMatchObject({
        type: "class",
        name: "MyClass",
        line: 1,
        signature: "class MyClass {"
      });

      const abstractClass = result.entities.find(e => e.name === "BaseClass");
      expect(abstractClass).toMatchObject({
        type: "class",
        name: "BaseClass",
        line: 5,
        signature: "export abstract class BaseClass {"
      });
    });

    it("should extract interface declarations", () => {
      const code = `interface User {
  id: string;
  name: string;
}

export interface Config {
  apiUrl: string;
}`;

      const result = analyzeFileBasic("test.ts", code);

      expect(result.entities).toHaveLength(2);

      const userInterface = result.entities.find(e => e.name === "User");
      expect(userInterface).toMatchObject({
        type: "interface",
        name: "User",
        line: 1
      });

      const configInterface = result.entities.find(e => e.name === "Config");
      expect(configInterface).toMatchObject({
        type: "interface",
        name: "Config",
        line: 6
      });
    });

    it("should extract type declarations", () => {
      const code = `type Status = "active" | "inactive";
export type ID = string | number;`;

      const result = analyzeFileBasic("test.ts", code);

      expect(result.entities).toHaveLength(2);

      const statusType = result.entities.find(e => e.name === "Status");
      expect(statusType).toMatchObject({
        type: "type",
        name: "Status",
        line: 1
      });

      const idType = result.entities.find(e => e.name === "ID");
      expect(idType).toMatchObject({
        type: "type",
        name: "ID",
        line: 2
      });
    });

    it("should extract import statements", () => {
      const code = `import React from 'react';
import { useState, useEffect } from 'react';
import * as fs from "fs";
import defaultImport from './utils';`;

      const result = analyzeFileBasic("test.js", code);

      expect(result.entities).toHaveLength(4);

      const reactImport = result.entities.find(
        e => e.module === "react" && e.name === "React"
      );
      expect(reactImport).toMatchObject({
        type: "import",
        name: "React",
        module: "react",
        line: 1
      });

      const namedImport = result.entities.find(e => e.name.includes("useState"));
      expect(namedImport).toMatchObject({
        type: "import",
        module: "react",
        line: 2
      });

      const namespaceImport = result.entities.find(e => e.module === "fs");
      expect(namespaceImport).toMatchObject({
        type: "import",
        module: "fs",
        line: 3
      });
    });

    it("should extract export statements", () => {
      const code = `export { foo, bar } from './utils';
export * from './types';
export * as helpers from './helpers';
export default myFunction;
export default function() {}`;

      const result = analyzeFileBasic("test.js", code);

      expect(result.entities).toHaveLength(5);

      const namedExport = result.entities.find(e => e.name.includes("foo"));
      expect(namedExport).toMatchObject({
        type: "export",
        exportType: "named",
        module: "./utils",
        isReExport: true,
        line: 1
      });

      const allExport = result.entities.find(
        e => e.name === "*" && e.module === "./types"
      );
      expect(allExport).toMatchObject({
        type: "export",
        exportType: "all",
        module: "./types",
        isReExport: true,
        line: 2
      });

      const namespaceExport = result.entities.find(e => e.name === "* as helpers");
      expect(namespaceExport).toMatchObject({
        type: "export",
        exportType: "namespace",
        module: "./helpers",
        isReExport: true,
        line: 3
      });

      const defaultExports = result.entities.filter(e => e.exportType === "default");
      expect(defaultExports).toHaveLength(2);
      expect(defaultExports[0].name).toBe("default (myFunction)");
      expect(defaultExports[1].name).toBe("default");
    });

    it("should include context lines when requested", () => {
      const code = `// Comment before
function testFunc() {
  return true;
}
// Comment after`;

      const result = analyzeFileBasic("test.js", code, { context: 1 });

      expect(result.entities).toHaveLength(1);

      const func = result.entities[0];
      expect(func.contextLines).toHaveLength(2);
      expect(func.contextLines).toEqual([
        { number: 1, content: "// Comment before" },
        { number: 3, content: "  return true;" }
      ]);
    });

    it("should not include context when context size is 0", () => {
      const code = `function testFunc() {
  return true;
}`;

      const result = analyzeFileBasic("test.js", code, { context: 0 });

      const func = result.entities[0];
      expect(func.contextLines).toEqual([]);
    });

    it("should return correct file metadata", () => {
      const code = `line 1
line 2
line 3`;

      const result = analyzeFileBasic("/path/to/test.js", code);

      expect(result.filePath).toBe("/path/to/test.js");
      expect(result.totalLines).toBe(3);
      expect(result.callExpressions).toEqual([]);
      expect(result.typeInfo).toEqual({
        typeAliases: [],
        interfaces: [],
        classes: [],
        enums: [],
        typeReferences: []
      });
    });

    it("should handle empty file", () => {
      const result = analyzeFileBasic("empty.js", "");

      expect(result.entities).toHaveLength(0);
      expect(result.totalLines).toBe(1); // Empty string split gives [""]
    });

    it("should handle whitespace-only file", () => {
      const code = `   
  
    `;

      const result = analyzeFileBasic("whitespace.js", code);

      expect(result.entities).toHaveLength(0);
      expect(result.totalLines).toBe(3);
    });

    it("should handle complex mixed content", () => {
      const code = `import React from 'react';

export interface Props {
  name: string;
}

class Component {
  render() {
    return null;
  }
}

export const helper = async () => {
  return true;
};

export default Component;`;

      const result = analyzeFileBasic("complex.tsx", code, { context: 1 });

      expect(result.entities).toHaveLength(5); // import, interface, class, helper function, default export
      expect(result.totalLines).toBe(17);

      const entities = result.entities;
      expect(entities.some(e => e.type === "import")).toBe(true);
      expect(entities.some(e => e.type === "interface")).toBe(true);
      expect(entities.some(e => e.type === "class")).toBe(true);
      expect(entities.some(e => e.type === "function")).toBe(true);
      expect(entities.some(e => e.type === "export")).toBe(true);
    });

    describe("edge cases", () => {
      it("should handle malformed function declarations", () => {
        const code = `function // incomplete
const invalid = 
class`;

        const result = analyzeFileBasic("malformed.js", code);

        // Should not crash and should find partial matches where possible
        expect(result.entities).toHaveLength(0); // None match the full patterns
      });

      it("should handle very long lines", () => {
        const longLine = "export const veryLongFunction = () => {};";

        const result = analyzeFileBasic("long.js", longLine);

        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].signature).toBe(longLine);
      });

      it("should handle special characters in names", () => {
        const code = `function $special() {}
const _underscore = () => {};
class Component$ {}`;

        const result = analyzeFileBasic("special.js", code);

        // The regex \w+ doesn't match $ characters, only word characters (letters, digits, underscore)
        expect(result.entities).toHaveLength(2);
        expect(result.entities.map(e => e.name)).toEqual([
          "_underscore",
          "Component"
        ]);
      });

      it("should handle nested structures (basic level)", () => {
        const code = `class Outer {
  method() {
    function inner() {}
  }
}`;

        const result = analyzeFileBasic("nested.js", code);

        // Basic parser catches class and method declarations
        expect(result.entities).toHaveLength(2); // Class and method
        const classEntity = result.entities.find(e => e.type === "class");
        expect(classEntity?.name).toBe("Outer");
      });
    });
  });
});
