import { SimpleAQLParser } from "../parser/simple-parser";
import { describe, it, expect, beforeEach } from "vitest";

describe("AQL: Explicit Prompt Bypass", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  it("should handle explicit prompt bypass", () => {
    const aql = `query ExplicitPromptTest {
  result: agent(model: "test") {
    prompt: "<ROLE>You are a helpful assistant</ROLE>

    <TASK>Summarize the following text</TASK>

    <INPUT>This is a test input</INPUT>"
  }
}`;

    const result = parser.parse(aql);
    
    // When an explicit prompt is provided, it should be used as-is (parser keeps outer quotes)
    expect(result.operations[0].config.prompt).toBe(`"<ROLE>You are a helpful assistant</ROLE>

    <TASK>Summarize the following text</TASK>

    <INPUT>This is a test input</INPUT>"`);
  });
});