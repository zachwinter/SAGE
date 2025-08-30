import { SimpleAQLParser } from "../../parser/simple-parser";

describe("AQL Parser: Parameters", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  test("should parse query with parameters", () => {
    const aql = `
      query AnalyzeText($text: String!, $depth: Int = 3) {
        analysis: agent(model: "llama3:13b") {
          prompt: "Analyze this text: {{text}}"
          input: $text
        }
      }
    `;

    const result = parser.parse(aql);

    expect(result.name).toBe("AnalyzeText");
    expect(result.parameters).toHaveLength(2);

    const textParam = result.parameters.find(p => p.name === "text");
    expect(textParam).toBeDefined();
    expect(textParam!.type.name).toBe("String");
    expect(textParam!.required).toBe(true);

    const depthParam = result.parameters.find(p => p.name === "depth");
    expect(depthParam).toBeDefined();
    expect(depthParam!.type.name).toBe("Int");
    expect(depthParam!.defaultValue).toBe(3);
  });

  test("should parse primitive types", () => {
    const aql = `
      query TypeTest($str: String, $num: Int, $float: Float, $bool: Boolean) {
        test: agent(model: "gemma3:4b-it-qat") {
          prompt: "Test"
          input: $str
        }
      }
    `;

    const result = parser.parse(aql);
    const params = result.parameters;

    expect(params.find(p => p.name === "str")!.type.name).toBe("String");
    expect(params.find(p => p.name === "num")!.type.name).toBe("Int");
    expect(params.find(p => p.name === "float")!.type.name).toBe("Float");
    expect(params.find(p => p.name === "bool")!.type.name).toBe("Boolean");
  });

  test("should parse collection types", () => {
    const aql = `
      query CollectionTest($items: [String]) {
        test: agent(model: "gemma3:4b-it-qat") {
          prompt: "Test"
          input: $items
        }
      }
    `;

    const result = parser.parse(aql);
    const param = result.parameters[0];

    expect(param.type.kind).toBe("collection");
    expect(param.type.elementType!.name).toBe("String");
  });

  test("should correctly parse various parameter definitions", () => {
    const aql = `
      query ParamTest(
        $foo: String!,
        $bar: Int = 3,
        $baz: [Boolean]
      ) {
        op: agent(model: "x") { prompt: "..." }
      }
    `;
    const parsed = parser.parse(aql);

    const foo = parsed.parameters.find(p => p.name === "foo");
    expect(foo).toBeDefined();
    expect(foo!.required).toBe(true);
    expect(foo!.type.name).toBe("String");
    expect(foo!.type.kind).toBe("primitive");

    const bar = parsed.parameters.find(p => p.name === "bar");
    expect(bar).toBeDefined();
    expect(bar!.defaultValue).toBe(3);
    expect(bar!.type.name).toBe("Int");

    const baz = parsed.parameters.find(p => p.name === "baz");
    expect(baz).toBeDefined();
    expect(baz!.required).toBe(false);
    expect(baz!.type.kind).toBe("collection");
    expect(baz!.type.name).toBe("[Boolean]");
    expect(baz!.type.elementType?.name).toBe("Boolean");
  });
});
