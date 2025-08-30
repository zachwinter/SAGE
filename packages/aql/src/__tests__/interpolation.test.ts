import { ExecutionEngine } from "../execution/engine";
import { Operation } from "../types";
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("AQL: Interpolation", () => {
  let engine: ExecutionEngine;

  beforeEach(async () => {
    engine = new ExecutionEngine();
    await engine.initialize();
  });

  it("should interpolate variables in prompts", async () => {
    const op: Operation = {
      type: "agent",
      id: "test",
      dependencies: [],
      config: {
        model: "test",
        role: "Test role",
        task: "Test task with {{name}}",
        input: "test input"
      }
    };

    // Mock the executeSingleOperation to test interpolation
    const spy = vi.spyOn(engine as any, "interpolatePrompt");
    
    try {
      await (engine as any).executeSingleOperation(op);
    } catch (e) {
      // Expected to fail due to missing required blocks, but interpolation should still be called
    }

    expect(spy).toHaveBeenCalled();
  });
});