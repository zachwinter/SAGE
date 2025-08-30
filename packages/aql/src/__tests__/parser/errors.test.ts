import { SimpleAQLParser } from "../../parser/simple-parser";

describe("AQL Parser: Error Handling", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  test("should throw error for missing query declaration", () => {
    const aql = `
      operation: agent(model: "gemma3:4b-it-qat") {
        prompt: "Test"
      }
    `;

    expect(() => parser.parse(aql)).toThrow(
      "Invalid query syntax: Could not find query declaration."
    );
  });

  test("should throw error for invalid query syntax", () => {
    const aql = `
      query InvalidSyntax(
        operation: agent(model: "gemma3:4b-it-qat") {
          prompt: "Test"
        }
      }
    `;

    expect(() => parser.parse(aql)).toThrow(
      'Invalid parameter syntax: operation: agent(model: "gemma3:4b-it-qat"'
    );
  });
});
