import { SimpleAQLParser } from "../../parser/simple-parser";
import { describe, it, expect } from "vitest";

describe("AQL Parser: Inline Comments", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  it("should strip inline comments", () => {
    const aql = `// This is a comment
query TestQuery {
  // Another comment
  result: agent(model: "test") {
    prompt: "Test prompt"
    // This comment should be ignored
    input: "test"
  }
}`;

    const result = parser.parse(aql);
    
    expect(result.name).toBe("TestQuery");
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].config.prompt).toBe("Test prompt");
    expect(result.operations[0].config.input).toBe("test");
  });

  it("should preserve comments inside strings", () => {
    const aql = `query TestQuery {
  result: agent(model: "test") {
    prompt: "Test // This is not a comment prompt"
    input: "test"
  }
}`;

    const result = parser.parse(aql);
    
    expect(result.operations[0].config.prompt).toBe("Test // This is not a comment prompt");
  });

  it("should handle mixed comments and code", () => {
    const aql = `query TestQuery {  // Comment at end of line
  result: agent(model: "test") {  // Another comment
    prompt: "Test prompt"  // Comment after prompt
    input: "test"  // Comment after input
  }  // Comment after closing brace
}  // Comment after query`;

    const result = parser.parse(aql);
    
    expect(result.name).toBe("TestQuery");
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].config.prompt).toBe("Test prompt");
    expect(result.operations[0].config.input).toBe("test");
  });

  it("should handle multiple line comments", () => {
    const aql = `query TestQuery {
  // First comment
  // Second comment
  result: agent(model: "test") {
    // Third comment
    prompt: "Test prompt"
    // Fourth comment
    input: "test"
    // Fifth comment
  }
  // Sixth comment
}`;

    const result = parser.parse(aql);
    
    expect(result.name).toBe("TestQuery");
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].config.prompt).toBe("Test prompt");
    expect(result.operations[0].config.input).toBe("test");
  });
});