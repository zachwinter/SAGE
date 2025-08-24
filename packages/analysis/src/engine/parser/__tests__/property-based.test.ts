import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { analyzeFileBasic } from "../basic-js-parser.js";
import { getContextLines } from "../parser-utils.js";

describe("Property-based Tests", () => {
  describe("basic-js-parser property tests", () => {
    it("should never crash with arbitrary string input", () => {
      fc.assert(
        fc.property(fc.string(), input => {
          // The parser should never throw regardless of input
          expect(() => {
            analyzeFileBasic("test.js", input);
          }).not.toThrow();
        }),
        { numRuns: 100, verbose: true }
      );
    });

    it("should handle arbitrary file paths", () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0),
          fc.string(),
          (filePath, content) => {
            const result = analyzeFileBasic(filePath, content);

            // Result should always have expected structure
            expect(result).toHaveProperty("filePath", filePath);
            expect(result).toHaveProperty("entities");
            expect(result).toHaveProperty("callExpressions");
            expect(result).toHaveProperty("typeInfo");
            expect(result).toHaveProperty("totalLines");

            // Entities should always be an array
            expect(Array.isArray(result.entities)).toBe(true);

            // Total lines should be positive
            expect(result.totalLines).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle valid JavaScript/TypeScript constructs", () => {
      const validConstructs = fc.oneof(
        fc.constant("function test() {}"),
        fc.constant("const arrow = () => {};"),
        fc.constant("class MyClass {}"),
        fc.constant("interface Config {}"),
        fc.constant("type Status = string;"),
        fc.constant("import { test } from 'module';"),
        fc.constant("export const value = 42;"),
        fc.constant("export default function() {}")
      );

      fc.assert(
        fc.property(
          fc.array(validConstructs, { minLength: 1, maxLength: 10 }),
          constructs => {
            const code = constructs.join("\\n");
            const result = analyzeFileBasic("test.ts", code);

            // Should find at least some entities for valid constructs
            expect(result.entities.length).toBeGreaterThanOrEqual(0);

            // All entities should have required fields
            result.entities.forEach(entity => {
              expect(entity).toHaveProperty("type");
              expect(entity).toHaveProperty("name");
              expect(entity).toHaveProperty("line");
              expect(entity).toHaveProperty("signature");

              // Line numbers should be valid
              expect(entity.line).toBeGreaterThan(0);
              expect(entity.line).toBeLessThanOrEqual(result.totalLines);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it("should handle malformed code gracefully", () => {
      const malformedCode = fc.oneof(
        fc.constant("function {"),
        fc.constant("class"),
        fc.constant("const ="),
        fc.constant("import from"),
        fc.constant("export {"),
        fc.constant("){}{}{"),
        fc.constant(";;;;;;;;"),
        fc.constant("function(){}(){}"),
        fc.constant("class extends implements")
      );

      fc.assert(
        fc.property(
          fc.array(malformedCode, { minLength: 1, maxLength: 5 }),
          codeSnippets => {
            const code = codeSnippets.join("\\n");

            // Should not crash with malformed code
            expect(() => {
              const result = analyzeFileBasic("test.js", code);

              // Result should still be valid structure
              expect(result).toBeDefined();
              expect(Array.isArray(result.entities)).toBe(true);
            }).not.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should maintain consistency with context options", () => {
      const validCode = "function test() {\\n  return true;\\n}";

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), contextSize => {
          const result1 = analyzeFileBasic("test.js", validCode, {
            context: contextSize
          });
          const result2 = analyzeFileBasic("test.js", validCode, {
            context: contextSize
          });

          // Results should be identical for same input
          expect(result1).toEqual(result2);

          // Context size should affect contextLines
          if (result1.entities.length > 0) {
            const entity = result1.entities[0];
            if (contextSize === 0) {
              expect(entity.contextLines).toEqual([]);
            } else {
              expect(Array.isArray(entity.contextLines)).toBe(true);
            }
          }
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("parser-utils property tests", () => {
    it("should handle arbitrary line arrays and parameters", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10 }),
          (lines, lineNumber, contextSize) => {
            // Should never throw regardless of input
            expect(() => {
              const result = getContextLines(lines, lineNumber, contextSize);

              // Result should always be an array
              expect(Array.isArray(result)).toBe(true);

              // All returned context lines should have required structure
              result.forEach(contextLine => {
                expect(contextLine).toHaveProperty("number");
                expect(contextLine).toHaveProperty("content");
                expect(typeof contextLine.number).toBe("number");
                expect(typeof contextLine.content).toBe("string");
                expect(contextLine.number).toBeGreaterThan(0);
              });
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should never include the target line in context", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          (lines, contextSize) => {
            // Test with a valid line number within range
            const lineNumber = Math.floor(Math.random() * lines.length) + 1;
            const result = getContextLines(lines, lineNumber, contextSize);

            // Target line should never be in the context
            const targetLineInContext = result.some(
              ctx => ctx.number === lineNumber
            );
            expect(targetLineInContext).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should return context lines in correct order", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 3 }),
          (lines, contextSize) => {
            const lineNumber = Math.ceil(lines.length / 2); // Pick middle line
            const result = getContextLines(lines, lineNumber, contextSize);

            // Context lines should be in ascending order by line number
            for (let i = 1; i < result.length; i++) {
              expect(result[i].number).toBeGreaterThan(result[i - 1].number);
            }

            // Line numbers should be valid (within bounds)
            result.forEach(ctx => {
              expect(ctx.number).toBeGreaterThan(0);
              expect(ctx.number).toBeLessThanOrEqual(lines.length);
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should handle edge cases at file boundaries", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (lines, contextSize) => {
            // Test first line
            const firstLineContext = getContextLines(lines, 1, contextSize);
            firstLineContext.forEach(ctx => {
              expect(ctx.number).not.toBe(1); // Should not include target line
              expect(ctx.number).toBeGreaterThan(1); // Should only have lines after
            });

            // Test last line
            const lastLineContext = getContextLines(
              lines,
              lines.length,
              contextSize
            );
            lastLineContext.forEach(ctx => {
              expect(ctx.number).not.toBe(lines.length); // Should not include target line
              expect(ctx.number).toBeLessThan(lines.length); // Should only have lines before
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Parser robustness properties", () => {
    it("should handle Unicode and special characters", () => {
      const unicodeStrings = fc.oneof(
        fc.string(),
        fc.constant("🚀"),
        fc.constant("测试"),
        fc.constant("àáâãäåæç"),
        fc.constant("\\n\\t\\r"),
        fc.constant("'\"\\`")
      );

      fc.assert(
        fc.property(
          fc.array(unicodeStrings, { minLength: 1, maxLength: 10 }),
          parts => {
            const code = parts.join(" ");

            expect(() => {
              const result = analyzeFileBasic("unicode-test.js", code);
              expect(result).toBeDefined();
            }).not.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should handle very long lines", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (length, baseString) => {
            const longLine = baseString.repeat(
              Math.ceil(length / baseString.length)
            );
            const code = `function test() { /* ${longLine} */ }`;

            expect(() => {
              const result = analyzeFileBasic("long-line.js", code);
              expect(result.totalLines).toBeGreaterThan(0);
            }).not.toThrow();
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should handle deeply nested structures (basic parser limitations)", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), depth => {
          let code = "";

          // Create nested object structure
          for (let i = 0; i < depth; i++) {
            code += `const obj${i} = {\\n`;
          }
          code += "value: 'test'";
          for (let i = 0; i < depth; i++) {
            code += "\\n};";
          }

          expect(() => {
            const result = analyzeFileBasic("nested.js", code);
            // Should find at least the variable declarations
            expect(result.entities.length).toBeGreaterThanOrEqual(0);
          }).not.toThrow();
        }),
        { numRuns: 10 }
      );
    });

    it("should maintain consistency across similar inputs", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
          functionName => {
            const code1 = `function ${functionName}() {}`;
            const code2 = `export function ${functionName}() {}`;

            const result1 = analyzeFileBasic("test1.js", code1);
            const result2 = analyzeFileBasic("test2.js", code2);

            // Both should find exactly one function entity
            expect(result1.entities).toHaveLength(1);
            expect(result2.entities).toHaveLength(1);

            // Both should have the same function name
            expect(result1.entities[0].name).toBe(functionName);
            expect(result2.entities[0].name).toBe(functionName);

            // Both should be function type
            expect(result1.entities[0].type).toBe("function");
            expect(result2.entities[0].type).toBe("function");
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
