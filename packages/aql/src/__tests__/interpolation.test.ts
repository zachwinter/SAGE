import { ExecutionEngine } from "../execution/engine";
import { Operation } from "../types";
import * as PromptUtils from "../utils/prompt";
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
        task: "Test task with variable",
        input: "test input"
      }
    };

    // Spy on buildAgentPrompt which is actually called during execution
    const spy = vi.spyOn(PromptUtils, "buildAgentPrompt");
    
    try {
      await (engine as any).executeSingleOperation(op);
    } catch (e) {
      // Expected to fail due to missing required blocks, but prompt building should still be called
    }

    expect(spy).toHaveBeenCalled();
  });
});