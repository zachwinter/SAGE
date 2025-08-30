import { ExecutionEngine } from "../execution/engine";
import { Operation } from "../types";
import * as PromptParser from "../parser/prompt-parser";
import { describe, it, expect, vi } from "vitest";

describe("Agent Prompt Block Expansion", () => {
  it("builds prompt from role, task, input", async () => {
    const op: Operation = {
      type: "agent",
      id: "foo",
      dependencies: [],
      config: {
        model: "gemma3:12b-it-qat",
        role: "Data wizard",
        task: "Sort the bananas",
        input: "ripe bananas"
      }
    };

    const engine = new ExecutionEngine();
    await engine.initialize();
    const spy = vi.spyOn(PromptParser, "parsePromptBlocks");

    await engine["executeSingleOperation"](op);

    const expectedPrompt = `<ROLE>
Data wizard
</ROLE>

<TASK>
Sort the bananas
</TASK>

<INPUT>
ripe bananas
</INPUT>`;
    expect(spy).toHaveBeenCalledWith(expectedPrompt);
  });

  it("includes SCHEMA block if schema is provided", async () => {
    const op: Operation = {
      type: "agent",
      id: "bar",
      dependencies: [],
      config: {
        model: "gemma3:4b-it-qat",
        role: "Schema sensei",
        task: "Use this schema wisely",
        schema: "(:User)-[:FOLLOWS]->(:User)",
        input: "who follows whom"
      }
    };

    const engine = new ExecutionEngine();
    await engine.initialize();
    const spy = vi.spyOn(PromptParser, "parsePromptBlocks");

    await engine["executeSingleOperation"](op);

    expect(spy.mock.calls[0][0]).toContain("<SCHEMA>");
    expect(spy.mock.calls[0][0]).toContain("(:User)-[:FOLLOWS]->(:User)");
  });

  it("throws if required blocks are missing", async () => {
    const op: Operation = {
      type: "agent",
      id: "baz",
      dependencies: [],
      config: {
        model: "gemma3:4b-it-qat",
        // Missing role and task
        input: "some input"
      }
    } as any;

    const engine = new ExecutionEngine();
    await engine.initialize();

    await expect(engine["executeSingleOperation"](op)).rejects.toThrow(
      "Missing required <ROLE> block in prompt"
    );
  });
});
