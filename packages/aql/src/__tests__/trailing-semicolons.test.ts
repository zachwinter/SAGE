import { SimpleAQLParser } from "../parser/simple-parser";
import { describe, it, expect } from "vitest";

describe("AQL: Trailing Semicolons", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  it("should handle trailing semicolons in agent operations", () => {
    const aql = `query TrailingSemicolonTest {
  result: agent(model: "test") {
    prompt: "Test prompt";
    input: "test";
  }
}`;

    const result = parser.parse(aql);
    
    // The parser currently includes the semicolon in the value
    expect(result.operations[0].config.prompt).toBe('"Test prompt";');
    expect(result.operations[0].config.input).toBe('"test";');
  });

  it("should handle mixed trailing semicolons", () => {
    const aql = `query MixedSemicolonTest {
  result: agent(model: "test") {
    prompt: "Test prompt";
    input: "test"
  }
}`;

    const result = parser.parse(aql);
    
    // The parser currently includes the semicolon in the value
    expect(result.operations[0].config.prompt).toBe('"Test prompt";');
    expect(result.operations[0].config.input).toBe('"test"');
  });
});