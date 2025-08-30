import { SimpleAQLParser } from "../../parser/simple-parser";

describe("AQL Parser: Strings", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  test("should handle escaped characters in strings", () => {
    const aql = `
      query EscapedChars {
        test: agent(model: "x") {
          prompt: \`A prompt with "quotes" and a newline\nNext line\`
        }
      }
    `;
    const parsed = parser.parse(aql);
    const op = parsed.operations[0];
    expect(op.config.prompt).toBe('A prompt with "quotes" and a newline\nNext line');
  });

  test("should handle escaped backslashes and tabs", () => {
    const aql = `
    query Backslashes {
      test: agent(model: "x") {
        prompt: "C:\\\\Users\\\\Zach\\tTabbed"
      }
    }
  `;
    const parsed = parser.parse(aql);
    const op = parsed.operations[0];
    expect(op.config.prompt).toBe("C:\\Users\\Zach\tTabbed");
  });

  test("should preserve unicode and emojis", () => {
    const aql = `
    query Unicode {
      test: agent(model: "x") {
        prompt: "hello 🌍 — こんにちは"
      }
    }
  `;
    const parsed = parser.parse(aql);
    const op = parsed.operations[0];
    expect(op.config.prompt).toBe("hello 🌍 — こんにちは");
  });

  test("should handle escaped double quotes only inside string", () => {
    const aql = `
    query Quotes {
      test: agent(model: "x") {
        prompt: "Quote: \\"double\\""
      }
    }
  `;
    const parsed = parser.parse(aql);
    const op = parsed.operations[0];
    expect(op.config.prompt).toBe('Quote: "double"');
  });
});
