import { SimpleAQLParser } from "../parser/simple-parser";
import { ExecutionEngine } from "../execution/engine";
import { describe, it, expect } from "vitest";

describe("AQL Core Components", () => {
  describe("SimpleAQLParser", () => {
    it("should parse a valid query without throwing an error", () => {
      const parser = new SimpleAQLParser();
      const query = `
        query HelloTest($name: String = "World") {
          greeting: agent(model: "gemma3:4b-it-qat") {
            prompt: "Say hello to {{name}}"
            input: $name
          }
        }
      `;

      expect(() => parser.parse(query)).not.toThrow();
    });

    it("should correctly identify query name, parameters, and operations", () => {
      const parser = new SimpleAQLParser();
      const query = `
        query HelloTest($name: String = "World") {
          greeting: agent(model: "gemma3:4b-it-qat") {
            prompt: "Say hello to {{name}}"
            input: $name
          }
        }
      `;
      const parsed = parser.parse(query);

      expect(parsed.name).toBe("HelloTest");
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.operations).toHaveLength(1);
      expect(parsed.operations[0].name).toBe("greeting");
    });
  });

  describe("ExecutionEngine", () => {
    it("should instantiate without throwing an error", () => {
      expect(() => new ExecutionEngine()).not.toThrow();
    });
  });
});
