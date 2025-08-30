import { SimpleAQLParser } from "../../parser/simple-parser";

describe("AQL Parser: Whitespace", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  test("should be whitespace-agnostic", () => {
    const aql = `
      query WhitespaceTest( $p1:String,
          $p2 : [ Int ] ) 
        {
        op1: 
          agent( model: "x" ) {
          prompt:      "..."
        }
      }
    `;
    expect(() => parser.parse(aql)).not.toThrow();
    const parsed = parser.parse(aql);
    expect(parsed.name).toBe("WhitespaceTest");
    expect(parsed.parameters).toHaveLength(2);
    expect(parsed.operations).toHaveLength(1);
  });
});
