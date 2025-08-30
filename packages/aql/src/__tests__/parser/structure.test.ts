import { SimpleAQLParser } from "../../parser/simple-parser";
import { describe, beforeEach, it, expect } from "vitest";

describe("AQL Parser: Structure", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  it("should parse simple query without parameters", () => {
    const aql = `
      query HelloWorld {
        greeting: agent(model: "gemma3:4b-it-qat") {
          prompt: "Say hello"
          input: "world"
        }
      }
    `;

    const result = parser.parse(aql);

    expect(result.name).toBe("HelloWorld");
    expect(result.parameters).toHaveLength(0);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].type).toBe("agent");
    expect(result.operations[0].name).toBe("greeting");
  });

  it("should handle deeply nested operations", () => {
    const aql = `
      query NestingTest($x: String) {
        level1: agent(model: "x") {
          prompt: "..."
          input: $x
        }

        level2: sequential {
          step1: agent(model: "x") { 
            prompt: "..."; 
            input: level1 
          }
          step2: parallel {
            a: agent(model: "x") { 
              prompt: "..."; 
              input: step1 
            }
            b: agent(model: "x") { 
              prompt: "..."; 
              input: step1 
            }
          }
        }
      }
    `;

    const parsed = parser.parse(aql);
    expect(parsed.operations).toHaveLength(2);

    const level1 = parsed.operations[0];
    expect(level1.name).toBe("level1");
    expect(level1.type).toBe("agent");

    const level2 = parsed.operations[1];
    expect(level2.name).toBe("level2");
    expect(level2.type).toBe("sequential");
    expect(level2.config.operations).toHaveLength(2);

    const step1 = level2.config.operations![0];
    expect(step1.name).toBe("step1");
    expect(step1.type).toBe("agent");
    expect(step1.dependencies).toContain("level1");

    const step2 = level2.config.operations![1];
    expect(step2.type).toBe("parallel");
    expect(step2.config.operations).toHaveLength(2);

    const a = step2.config.operations![0];
    expect(a.name).toBe("a");
    expect(a.dependencies).toContain("step1");

    const b = step2.config.operations![1];
    expect(b.name).toBe("b");
    expect(b.dependencies).toContain("step1");
  });

  it("should throw an error for alias collisions", () => {
    const aql = `
      query AliasCollision {
        op1: agent(model: "x") { prompt: "..." }
        op1: agent(model: "y") { prompt: "..." }
      }
    `;
    expect(() => parser.parse(aql)).toThrow('Alias "op1" is already defined.');
  });

  it("should ignore comment lines", () => {
    const aql = `
      // This is a comment
      query TestQuery {
        // Another comment
        result: agent(model: "gemma3:4b-it-qat") {
          prompt: "Test"
          input: "hello"
        }
      }
    `;

    const result = parser.parse(aql);

    expect(result.name).toBe("TestQuery");
    expect(result.operations).toHaveLength(1);
  });

  it("should correctly parse operation config values", () => {
    const parser = new SimpleAQLParser();
    const query = `
      query SimpleTest {
        greeting: agent(model: "qwen3:1.7b") {
          prompt: "Say hello in exactly 5 words"
          input: "test"
          temperature: 0.1
          maxTokens: 20
        }
      }
    `;

    const parsed = parser.parse(query);
    const operation = parsed.operations[0];

    expect(operation.config.model).toBe("qwen3:1.7b");
    expect(typeof operation.config.model).toBe("string");
    expect(operation.config.temperature).toBe(0.1);
    expect(operation.config.maxTokens).toBe(20);
  });
});
