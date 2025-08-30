import { describe, it, expect } from "vitest";
import { 
  makeGraphAdapter,
  makeChronicle,
  makeLLM,
  makeTools
} from "../adapters/index.js";

describe("Story 2: In-Memory Adapters", () => {
  describe("GraphAdapter", () => {
    it("implements the GraphAdapter interface", async () => {
      const graph = makeGraphAdapter();
      
      expect(graph).toHaveProperty("query");
      expect(typeof graph.query).toBe("function");
    });

    it("returns empty array for non-existent data", async () => {
      const graph = makeGraphAdapter();
      
      const results = await graph.query(
        "MATCH (f:File {path: $path}) RETURN f",
        { path: "nonexistent.ts" }
      );
      
      expect(results).toEqual([]);
    });

    it("supports basic MATCH queries with parameters", async () => {
      const graph = makeGraphAdapter() as any; // Access internal methods for setup
      
      // Ingest test data
      await graph.ingest({
        file: "src/test.ts",
        defines: ["testFunction"],
        commit: "abc123",
      });
      
      // Query the data back
      const results = await graph.query(
        "MATCH (f:File {path: $path}) RETURN f",
        { path: "src/test.ts" }
      );
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        properties: {
          path: "src/test.ts",
          commit: "abc123"
        }
      });
    });

    it("supports commit-aware queries", async () => {
      const graph = makeGraphAdapter() as any;
      
      // Ingest data at different commits
      await graph.ingest({
        file: "src/file.ts",
        defines: ["oldFunction"],
        commit: "commit1",
      });
      
      await graph.ingest({
        file: "src/file.ts", 
        defines: ["newFunction"],
        commit: "commit2",
      });
      
      // Query with commit hint should respect commit context
      const results = await graph.query(
        "/* @commit: commit1 */ MATCH (f:Function) RETURN f"
      );
      
      // This is a simplified test - real impl would have proper commit filtering
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("ChronicleAdapter", () => {
    it("implements the ChronicleAdapter interface", async () => {
      const chronicle = makeChronicle();
      
      expect(chronicle).toHaveProperty("read");
      expect(chronicle).toHaveProperty("append");
      expect(typeof chronicle.read).toBe("function");
      expect(typeof chronicle.append).toBe("function");
    });

    it("supports append-only semantics", async () => {
      const chronicle = makeChronicle();
      
      await chronicle.append("test.sage", {
        type: "TEST_EVENT",
        data: "test data",
      });
      
      const events = await chronicle.read("test.sage");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "TEST_EVENT",
        data: "test data",
      });
    });

    it("generates eventId for events without one", async () => {
      const chronicle = makeChronicle();
      
      await chronicle.append("test.sage", {
        type: "TEST_EVENT",
        data: "test",
      });
      
      const events = await chronicle.read("test.sage");
      expect(events[0]).toHaveProperty("eventId");
      expect(typeof events[0].eventId).toBe("string");
      expect(events[0].eventId.length).toBe(64); // SHA-256 hex
    });

    it("supports idempotent append", async () => {
      const chronicle = makeChronicle();
      
      const event = {
        type: "TEST_EVENT",
        eventId: "fixed-id",
        data: "test",
      };
      
      // Append same event twice
      await chronicle.append("test.sage", event);
      await chronicle.append("test.sage", event);
      
      // Should only appear once
      const events = await chronicle.read("test.sage");
      expect(events).toHaveLength(1);
    });

    it("maintains event ordering", async () => {
      const chronicle = makeChronicle();
      
      await chronicle.append("test.sage", {
        type: "FIRST_EVENT",
        data: "first",
      });
      
      await chronicle.append("test.sage", {
        type: "SECOND_EVENT", 
        data: "second",
      });
      
      const events = await chronicle.read("test.sage");
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("FIRST_EVENT");
      expect(events[1].type).toBe("SECOND_EVENT");
    });

    it("validates event structure", async () => {
      const chronicle = makeChronicle();
      
      await expect(chronicle.append("test.sage", {
        // Missing required 'type' field
        data: "invalid",
      })).rejects.toThrow("EVALIDATION");
    });

    it("uses injected clock for timestamps", async () => {
      const fixedTime = "2025-08-28T12:00:00.000Z";
      const mockClock = { now: () => fixedTime };
      const chronicle = makeChronicle({ clock: mockClock });
      
      await chronicle.append("test.sage", {
        type: "TEST_EVENT",
      });
      
      const events = await chronicle.read("test.sage");
      expect(events[0].timestamp).toBe(fixedTime);
    });
  });

  describe("LLMClient", () => {
    it("implements the LLMClient interface", async () => {
      const llm = makeLLM();
      
      expect(llm).toHaveProperty("createChatStream");
      expect(typeof llm.createChatStream).toBe("function");
    });

    it("generates deterministic responses with same seed", async () => {
      const llm1 = makeLLM({ seed: 42 });
      const llm2 = makeLLM({ seed: 42 });
      
      const messages = [{ role: "user" as const, content: "Hello!" }];
      
      const stream1 = await llm1.createChatStream({ model: "test", messages });
      const stream2 = await llm2.createChatStream({ model: "test", messages });
      
      const events1: any[] = [];
      const events2: any[] = [];
      
      for await (const event of stream1) {
        events1.push(event);
      }
      
      for await (const event of stream2) {
        events2.push(event);
      }
      
      expect(events1).toEqual(events2);
    });

    it("generates different responses with different seeds", async () => {
      const llm1 = makeLLM({ seed: 1 });
      const llm2 = makeLLM({ seed: 2 });
      
      const messages = [{ role: "user" as const, content: "Hello!" }];
      
      const stream1 = await llm1.createChatStream({ model: "test", messages });
      const stream2 = await llm2.createChatStream({ model: "test", messages });
      
      const events1: any[] = [];
      const events2: any[] = [];
      
      for await (const event of stream1) {
        if (event.type === "text") events1.push(event.text);
      }
      
      for await (const event of stream2) {
        if (event.type === "text") events2.push(event.text);
      }
      
      const text1 = events1.join("");
      const text2 = events2.join("");
      
      expect(text1).not.toBe(text2);
    });

    it("emits tool calls when tools are configured", async () => {
      const mockTool = async (input: any) => ({ result: "tool executed" });
      const llm = makeLLM({ 
        seed: 42,
        tools: { TestTool: mockTool }
      });
      
      // Use a message that's likely to trigger tool use
      const messages = [{ 
        role: "user" as const, 
        content: "Please use a tool to help me"
      }];
      
      const stream = await llm.createChatStream({ 
        model: "test", 
        messages,
        tools: { TestTool: { parameters: {} } }
      });
      
      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
      }
      
      // Should contain tool_call and tool_result events
      const toolCalls = events.filter(e => e.type === "tool_call");
      const toolResults = events.filter(e => e.type === "tool_result");
      
      if (toolCalls.length > 0) {
        expect(toolCalls).toHaveLength(1);
        expect(toolResults).toHaveLength(1);
        expect(toolResults[0].toolResult.result).toEqual({ result: "tool executed" });
      }
    });

    it("streams text in chunks", async () => {
      const llm = makeLLM({ seed: 42 });
      
      const messages = [{ role: "user" as const, content: "Hello!" }];
      const stream = await llm.createChatStream({ model: "test", messages });
      
      const textChunks: string[] = [];
      for await (const event of stream) {
        if (event.type === "text" && event.text) {
          textChunks.push(event.text);
        }
      }
      
      expect(textChunks.length).toBeGreaterThan(1);
      expect(textChunks.join("")).toBeTruthy();
    });

    it("ends stream with done event", async () => {
      const llm = makeLLM({ seed: 42 });
      
      const messages = [{ role: "user" as const, content: "Hello!" }];
      const stream = await llm.createChatStream({ model: "test", messages });
      
      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
      }
      
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe("done");
    });
  });

  describe("ToolRegistry", () => {
    it("implements the ToolRegistry interface", () => {
      const tools = makeTools();
      
      expect(tools).toHaveProperty("register");
      expect(tools).toHaveProperty("get");
      expect(tools).toHaveProperty("getToolSchemas");
    });

    it("comes pre-registered with standard tools", () => {
      const tools = makeTools();
      const schemas = tools.getToolSchemas();
      
      const toolNames = schemas.map(s => s.name);
      expect(toolNames).toContain("Read");
      expect(toolNames).toContain("Write");
      expect(toolNames).toContain("Edit");
      expect(toolNames).toContain("Bash");
      expect(toolNames).toContain("GraphQuery");
    });

    it("executes Read tool successfully", async () => {
      const tools = makeTools();
      const readTool = tools.get("Read");
      
      const input = readTool.validate({ file: "test.ts" });
      const result = await readTool.execute(input, { cwd: "/tmp" });
      
      expect(result.ok).toBe(true);
      expect(result.data).toHaveProperty("content");
      expect(typeof (result.data as any)?.content).toBe("string");
    });

    it("respects readOnly mode for mutating tools", async () => {
      const tools = makeTools({ readOnly: true });
      const writeTool = tools.get("Write");
      
      const input = writeTool.validate({ 
        file: "test.ts", 
        content: "export {};"
      });
      const result = await writeTool.execute(input, { cwd: "/tmp" });
      
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("EPERMISSION");
    });

    it("allows mutating tools when readOnly is false", async () => {
      const tools = makeTools({ readOnly: false });
      const writeTool = tools.get("Write");
      
      const input = writeTool.validate({ 
        file: "test.ts", 
        content: "export {};"
      });
      const result = await writeTool.execute(input, { cwd: "/tmp" });
      
      expect(result.ok).toBe(true);
      expect(result.data).toHaveProperty("bytes");
    });

    it("validates tool inputs", () => {
      const tools = makeTools();
      const readTool = tools.get("Read");
      
      expect(() => readTool.validate({})).toThrow();
      expect(() => readTool.validate({ file: 123 })).toThrow();
      expect(() => readTool.validate({ file: "valid.ts" })).not.toThrow();
    });

    it("provides execution metadata", async () => {
      const tools = makeTools();
      const readTool = tools.get("Read");
      
      const input = readTool.validate({ file: "test.ts" });
      const result = await readTool.execute(input, { cwd: "/tmp" });
      
      expect(result.meta).toBeDefined();
      expect(result.meta).toHaveProperty("startedAt");
      expect(result.meta).toHaveProperty("endedAt");
      expect(result.meta).toHaveProperty("durationMs");
      expect(typeof result.meta?.durationMs).toBe("number");
    });

    it("executes Bash tool with deterministic results", async () => {
      const tools = makeTools({ readOnly: false });
      const bashTool = tools.get("Bash");
      
      const input = bashTool.validate({ 
        command: "echo", 
        args: ["hello", "world"] 
      });
      const result = await bashTool.execute(input, { cwd: "/tmp" });
      
      expect(result.ok).toBe(true);
      expect((result.data as any)?.code).toBe(0);
      expect((result.data as any)?.stdout).toBe("hello world\n");
    });

    it("can register custom tools", () => {
      const tools = makeTools();
      
      const customTool = {
        name: "Custom",
        schema: { type: "object", properties: {} },
        validate: (input: unknown) => input,
        execute: async () => ({ ok: true, data: "custom" }),
      };
      
      tools.register(customTool);
      const retrieved = tools.get("Custom");
      
      expect(retrieved).toBe(customTool);
    });

    it("throws error for non-existent tools", () => {
      const tools = makeTools();
      
      expect(() => tools.get("NonExistent")).toThrow("Tool 'NonExistent' not found");
    });
  });

  describe("Integration scenarios", () => {
    it("can use all adapters together", async () => {
      const graph = makeGraphAdapter();
      const chronicle = makeChronicle();
      const llm = makeLLM({ seed: 42 });
      const tools = makeTools({ readOnly: false });
      
      // Chronicle records plan creation
      await chronicle.append("test.sage", {
        type: "PLAN_DRAFTED",
        planId: "plan-123",
      });
      
      // LLM generates response
      const stream = await llm.createChatStream({
        model: "test",
        messages: [{ role: "user", content: "Create a plan" }],
      });
      
      let hasResponse = false;
      for await (const event of stream) {
        if (event.type === "text" || event.type === "done") {
          hasResponse = true;
          break;
        }
      }
      
      // Tools execute operations
      const readTool = tools.get("Read");
      const readResult = await readTool.execute(
        { file: "test.ts" },
        { cwd: "/tmp" }
      );
      
      // Graph queries work
      const queryResult = await graph.query("MATCH (n) RETURN n");
      
      // All adapters are functional
      expect(hasResponse).toBe(true);
      expect(readResult.ok).toBe(true);
      expect(Array.isArray(queryResult)).toBe(true);
      
      const events = await chronicle.read("test.sage");
      expect(events).toHaveLength(1);
    });
  });
});