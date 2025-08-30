import { SimpleAQLParser } from "../parser/simple-parser";
import { describe, it, expect } from "vitest";

describe("AQL: Schema Objects", () => {
  let parser: SimpleAQLParser;

  beforeEach(() => {
    parser = new SimpleAQLParser();
  });

  it("should handle schema objects", () => {
    const aql = `query SchemaTest {
  result: agent(model: "test") {
    role: "Data analyzer"
    task: "Analyze the data"
    schema: "(:User {name: String, age: Int})-[:FRIENDS_WITH]->(:User)"
    input: "User data"
  }
}`;

    const result = parser.parse(aql);
    
    expect(result.operations[0].config.schema).toBe("(:User {name: String, age: Int})-[:FRIENDS_WITH]->(:User)");
  });

  it("should handle complex schema objects", () => {
    const aql = `query ComplexSchemaTest {
  result: agent(model: "test") {
    role: "Graph database expert"
    task: "Generate Cypher query"
    schema: "(:Person {name: String, born: Int})-[:ACTED_IN {roles: [String]}]->(:Movie {title: String, released: Int})"
    input: "Find all actors born before 1970"
  }
}`;

    const result = parser.parse(aql);
    
    expect(result.operations[0].config.schema).toBe("(:Person {name: String, born: Int})-[:ACTED_IN {roles: [String]}]->(:Movie {title: String, released: Int})");
  });
});