import { SimpleAQLParser } from "../parser/simple-parser";
import { ExecutionEngine } from "../execution/engine";
import { describe, it, expect } from "vitest";

describe("AQL: Cyclic Dependencies", () => {
  it("should detect cyclic dependencies", async () => {
    const parser = new SimpleAQLParser();
    const engine = new ExecutionEngine();
    
    // Create a query with cyclic dependencies
    const aql = `query CyclicTest {
  op1: agent(model: "test") {
    prompt: "Test prompt 1"
    input: op2
  }
  
  op2: agent(model: "test") {
    prompt: "Test prompt 2"
    input: op1
  }
}`;

    const query = parser.parse(aql);
    
    await expect(engine.execute(query)).rejects.toThrow("Circular dependency detected");
  });

  it("should detect complex cyclic dependencies", async () => {
    const parser = new SimpleAQLParser();
    const engine = new ExecutionEngine();
    
    // Create a query with complex cyclic dependencies
    const aql = `query ComplexCyclicTest {
  op1: agent(model: "test") {
    prompt: "Test prompt 1"
    input: op3
  }
  
  op2: agent(model: "test") {
    prompt: "Test prompt 2"
    input: op1
  }
  
  op3: agent(model: "test") {
    prompt: "Test prompt 3"
    input: op2
  }
}`;

    const query = parser.parse(aql);
    
    await expect(engine.execute(query)).rejects.toThrow("Circular dependency detected");
  });
});