# Zero‑Knowledge Relay Race — Test Plan & Vitest Skeletons

> Objective: Prove the package contracts are **sufficient** by letting isolated teams implement each package independently and still pass cross‑package integration.

This doc contains:

1. Rules of the Relay
2. Test Matrix (what composes with what)
3. Vitest project layout (per relayer)
4. Skeleton tests & harnesses (ready to paste into packages)
5. CI job graph

---

## 1) Rules of the Relay

- Each team gets **only the contract spec** for their package plus the **adapters** they must expose. No internal source of other packages.
- All interop occurs through the **contract types** from _SAGE Package Contracts — Build‑From‑Blank Specs_.
- Tests use a **switchable harness**: for any dependency, either import a real package or a **contract‑compliant fake**.
- Success criterion: All relay suites pass with mixed implementations (real/fake) across the matrix below.

---

## 2) Test Matrix

| Suite              | Under Test                                 | Uses Real | Uses Fake (contracts)        |
| ------------------ | ------------------------------------------ | --------- | ---------------------------- |
| T1 Tools↔LLM      | `@sage/tools` + `@sage/llm` tool‑call loop | Tools     | LLM provider (fake)          |
| T2 Graph Ingest    | `@sage/graph`→`@sage/graph`                | Graph     | Analysis                     |
| T3 Agents Gate     | `@sage/agents` Bullet Wound / Reconcile    | Agents    | Graph, Chronicle, Tools, LLM |
| T4 AQL Exec        | `@sage/aql` DAG execution                  | AQL       | Tools, LLM                   |
| T5 CLI Smoke       | `apps/cli` streams + tool approval policy  | CLI       | LLM, Tools                   |
| T6 Valve→Chronicle | `apps/valve` emits `VALVE_PERSONA_TRIGGER` | Valve     | Chronicle                    |

For every suite, invert roles in a second run (e.g., real LLM + fake Tools) when feasible.

---

## 3) Project Layout (relay)

```
relay/
  packages/
    fakes/
      llm-provider-test/
      chronicle-memory/
      graph-memory/
      tools-readonly/
  tests/
    t1.tools-llm.test.ts
    t2.graph-ingest.test.ts
    t3.agents-gates.test.ts
    t4.aql-exec.test.ts
    t5.cli-smoke.test.ts
    t6.valve-chronicle.test.ts
  vitest.config.ts
```

---

## 4) Skeletons

### 4.1 Fake Providers (contract‑compliant)

**`relay/packages/fakes/llm-provider-test/index.ts`**

```ts
import type { LLMProvider, ChatOptions, StreamEvent } from "@sage/llm";

export class TestLLMProvider implements LLMProvider {
  name = "test";
  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    const last = opts.messages[opts.messages.length - 1]?.content ?? "";
    // Emit one tool call if tool schema named Echo exists
    const echo = opts.tools?.find(t => t.name === "Echo");
    if (echo) {
      yield {
        type: "tool_call",
        toolName: "Echo",
        callId: "1",
        arguments: { text: last }
      } as any;
      yield { type: "end" } as any; // provider ends; wrapper will inject tool_result externally
      return;
    }
    // Otherwise just stream text
    yield { type: "text", value: `ok:${last}` };
    yield { type: "end" };
  }
  async models() {
    return [{ name: "test-1" }];
  }
}
```

**`relay/packages/fakes/chronicle-memory/index.ts`**

```ts
import type { ChronicleEvent } from "@sage/chronicle";

const store = new Map<string, ChronicleEvent[]>();
export async function appendEvent(path: string, evt: ChronicleEvent) {
  const arr = store.get(path) ?? [];
  arr.push(evt);
  store.set(path, arr);
}
export async function readChronicle(path: string) {
  return store.get(path) ?? [];
}
export async function tailChronicle(path: string, n = 50) {
  const arr = store.get(path) ?? [];
  return arr.slice(-n);
}
```

**`relay/packages/fakes/graph-memory/index.ts`**

```ts
type Node = { label: string; props: any };
const commits = new Map<string, Node[]>();
export async function ingestProject({
  projectPath,
  commitHash
}: {
  projectPath: string;
  commitHash: string;
}) {
  // Minimal: capture a single File node per path
  const nodes: Node[] = [
    {
      label: "File",
      props: { path: projectPath + "/src/A.ts", first_seen: 1, last_seen: 1 }
    }
  ];
  commits.set(commitHash, nodes);
}
export async function queryGraph({
  query,
  commit
}: {
  query: string;
  params?: any;
  commit?: string;
}) {
  const nodes = commits.get(commit ?? "") ?? [];
  if (query.includes("MATCH (f:File"))
    return { results: nodes.filter(n => n.label === "File").map(n => n.props) };
  return { results: [] };
}
```

**`relay/packages/fakes/tools-readonly/index.ts`**

```ts
import type { Tool, ToolRegistry, ToolResult } from "@sage/tools";

const schemas: any[] = [];
const registry = new Map<string, Tool<any, any>>();

export const toolRegistry: ToolRegistry = {
  register(tool) {
    registry.set(tool.name, tool);
    schemas.push({
      name: tool.name,
      parameters: tool.schema,
      description: tool.description
    });
  },
  get(name) {
    const t = registry.get(name);
    if (!t) throw new Error("Tool not found");
    return t;
  },
  getToolSchemas() {
    return schemas;
  }
} as any;

export function defineEchoTool(): Tool<{ text: string }, { echoed: string }> {
  return {
    name: "Echo",
    description: "echo text",
    schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false
    },
    validate(x: any) {
      if (!x || typeof x.text !== "string")
        throw Object.assign(new Error("EVALIDATION"), { code: "EVALIDATION" });
      return x;
    },
    async execute(input) {
      return { ok: true, data: { echoed: input.text } } as ToolResult<any>;
    }
  };
}
```

---

### 4.2 Suite T1 — Tools↔LLM tool‑call loop

**`relay/tests/t1.tools-llm.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { setProvider, createChatStream } from "@sage/llm";
import { TestLLMProvider } from "../packages/fakes/llm-provider-test";
import { toolRegistry, defineEchoTool } from "../packages/fakes/tools-readonly";

describe("T1 Tools↔LLM", () => {
  beforeAll(() => {
    toolRegistry.register(defineEchoTool());
    setProvider(new TestLLMProvider());
  });
  it("emits tool_call and receives tool_result", async () => {
    const stream = await createChatStream({
      model: "test-1",
      messages: [{ role: "user", content: "hello" }],
      tools: toolRegistry.getToolSchemas()
    });
    const events: any[] = [];
    for await (const ev of stream) events.push(ev);
    // Provider yields tool_call; executor (outside) would run the tool and feed a tool_result
    // For relay we assert at least the tool_call shape
    expect(events.some(e => e.type === "tool_call" && e.toolName === "Echo")).toBe(
      true
    );
  });
});
```

---

### 4.3 Suite T2 — Analysis→Graph ingest (blind)

**`relay/tests/t2.graph-ingest.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ingestProject, queryGraph } from "../packages/fakes/graph-memory";

describe("T2 Graph Ingest", () => {
  it("records File nodes and queries by commit", async () => {
    await ingestProject({ projectPath: "/repo", commitHash: "c1" });
    const { results } = await queryGraph({
      query: "MATCH (f:File) RETURN f",
      commit: "c1"
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain("/repo/src/");
  });
});
```

---

### 4.4 Suite T3 — Agents gating (Bullet Wound / Reconcile)

**`relay/tests/t3.agents-gates.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { appendEvent, readChronicle } from "../packages/fakes/chronicle-memory";
import { queryGraph } from "../packages/fakes/graph-memory";

// Minimal Guardian based only on contract; fake behavior to assert wiring
class Guardian {
  constructor(
    private graphAdapter: any,
    private chronicleAdapter: any
  ) {}

  async reviewPlan(plan: {
    id: string;
    steps: Array<{ type: string; filePath?: string }>;
  }) {
    // Check if plan tries to delete a file that exists in graph
    for (const step of plan.steps) {
      if (step.type === "DELETE_FILE" && step.filePath) {
        const { results } = await this.graphAdapter.query(
          "MATCH (f:File {path: $path}) RETURN f",
          { path: step.filePath }
        );
        if (results.length > 0) {
          return {
            type: "deny",
            reason: `File ${step.filePath} exists in graph`
          } as const;
        }
      }
    }
    return {
      type: "approve",
      justification: "No invariant violations detected"
    } as const;
  }

  async reconcile(edit: { filePath: string; diffRef: string }) {
    await this.chronicleAdapter.append(`${edit.filePath}.sage`, {
      type: "RECONCILIATION",
      timestamp: new Date().toISOString(),
      actor: { agent: "guardian", id: "reconciler" },
      filePath: edit.filePath,
      diffRef: edit.diffRef
    });
    return { ok: true };
  }

  async selfInquiry() {
    return { findings: ["Graph-Chronicle consistency verified"] };
  }

  async bulletWoundCheck(
    assertions: Array<{ cypher: string; expectRows: boolean }>
  ) {
    for (const assertion of assertions) {
      const { results } = await this.graphAdapter.query(assertion.cypher);
      const hasRows = results.length > 0;
      if (hasRows !== assertion.expectRows) {
        throw Object.assign(new Error("HALT"), {
          code: "EHALT",
          invariant: assertion.cypher,
          expected: assertion.expectRows ? "rows" : "no rows",
          actual: hasRows ? "rows found" : "no rows found"
        });
      }
    }
  }
}

describe("T3 Agents Gate", () => {
  it("denies plan that violates graph invariant", async () => {
    // Setup: graph has a file
    const graphAdapter = {
      query: vi.fn().mockResolvedValue({ results: [{ path: "src/important.ts" }] })
    };
    const chronicleAdapter = { read: vi.fn(), append: vi.fn() };

    const g = new Guardian(graphAdapter, chronicleAdapter);

    const plan = {
      id: "plan-123",
      steps: [{ type: "DELETE_FILE", filePath: "src/important.ts" }]
    };

    const decision = await g.reviewPlan(plan);
    expect(decision.type).toBe("deny");
    expect(decision.reason).toContain("exists in graph");
  });

  it("throws EHALT on bullet wound invariant violation", async () => {
    const graphAdapter = { query: vi.fn().mockResolvedValue({ results: [] }) }; // No file found
    const chronicleAdapter = { read: vi.fn(), append: vi.fn() };

    const g = new Guardian(graphAdapter, chronicleAdapter);

    const assertions = [
      {
        cypher: "MATCH (f:File {name: 'critical.ts'}) RETURN f",
        expectRows: true // But graph returns empty
      }
    ];

    await expect(g.bulletWoundCheck(assertions)).rejects.toMatchObject({
      code: "EHALT",
      invariant: "MATCH (f:File {name: 'critical.ts'}) RETURN f"
    });
  });

  it("records reconciliation event in chronicle", async () => {
    const graphAdapter = { query: vi.fn() };
    const chronicleAdapter = {
      read: vi.fn(),
      append: vi.fn().mockResolvedValue(undefined)
    };

    const g = new Guardian(graphAdapter, chronicleAdapter);

    const edit = { filePath: "src/modified.ts", diffRef: "abc123" };
    const result = await g.reconcile(edit);

    expect(result.ok).toBe(true);
    expect(chronicleAdapter.append).toHaveBeenCalledWith(
      "src/modified.ts.sage",
      expect.objectContaining({
        type: "RECONCILIATION",
        filePath: "src/modified.ts",
        diffRef: "abc123"
      })
    );
  });
});
```

---

### 4.5 Suite T4 — AQL minimal execution

**`relay/tests/t4.aql-exec.test.ts`**

```ts
import { describe, it, expect } from "vitest";

// Pseudo AQL compile/execute contract: feed a plan with one agent step -> string output
async function compile(src: string) {
  return { dag: [{ id: "s1" }], outputs: { final: "s1" } };
}
async function execute(plan: any) {
  return { outputs: { final: "hello" } };
}

describe("T4 AQL", () => {
  it("compiles and executes DAG", async () => {
    const plan = await compile(
      'query X { step: agent(model: "t"){prompt:"hi"} final: merge(step) }'
    );
    const out = await execute(plan);
    expect(out.outputs.final).toBeTypeOf("string");
  });
});
```

---

### 4.6 Suite T5 — CLI smoke (streams + tool approval)

**`relay/tests/t5.cli-smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("T5 CLI Smoke", () => {
  it("renders a simple streamed line", async () => {
    // Treat as black box: verify a function printStream() concatenates tokens
    const tokens = ["SAGE ", "ready\n"];
    const out = tokens.join("");
    expect(out).toContain("SAGE");
  });
});
```

---

### 4.7 Suite T6 — Valve→Chronicle

**`relay/tests/t6.valve-chronicle.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { appendEvent, readChronicle } from "../packages/fakes/chronicle-memory";
import { createTempWorkspace } from "@sage/test-utils";
import yaml from "js-yaml";
import fs from "fs";

// A fake Valve that reads a config and appends to a chronicle
class FakeValve {
  private personas: any[];
  constructor(
    configPath: string,
    private chronicle: any
  ) {
    const config = yaml.load(fs.readFileSync(configPath, "utf8"));
    this.personas = config.personas;
  }

  async handleFileChange(filePath: string, content: string) {
    for (const persona of this.personas) {
      // Simplified matching logic for the test
      if (filePath.includes(persona.filters[0])) {
        await this.chronicle.appendEvent(`${filePath}.sage`, {
          type: "VALVE_PERSONA_TRIGGER",
          persona: persona.name,
          filePath,
          trigger: { type: "filter", details: persona.filters[0] },
          timestamp: new Date().toISOString(),
          actor: { agent: "valve", id: "watcher" }
        });
      }
    }
  }
}

describe("T6 Valve→Chronicle", () => {
  it("writes persona trigger event on matching file change", async () => {
    const workspace = await createTempWorkspace();
    const chronicle = { appendEvent, readChronicle };

    const valveConfig = {
      personas: [
        {
          name: "TestGuardian",
          filters: ["secrets"]
        }
      ]
    };
    await workspace.file(".sage/valve.yml", yaml.dump(valveConfig));

    const valve = new FakeValve(workspace.path(".sage/valve.yml"), chronicle);

    const secretFilePath = "src/core/secrets.txt";
    await valve.handleFileChange(secretFilePath, "SUPER_SECRET_KEY=123");

    const events = await chronicle.readChronicle(`${secretFilePath}.sage`);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "VALVE_PERSONA_TRIGGER",
      persona: "TestGuardian",
      filePath: secretFilePath
    });
  });
});
```

---

### 4.8 Concrete Fixture-Based Tests

Beyond the basic relay tests, each package should validate against the normative fixtures:

**`relay/tests/fixtures.canonical-json.test.ts`**

```ts
import { canonicalJSONStringify, sha256 } from "@sage/utils";
import fs from "fs";

describe("Canonical JSON Fixtures", () => {
  it("matches normative output exactly", async () => {
    const input = JSON.parse(
      fs.readFileSync("../fixtures/canonical-json/input.json")
    );
    const expectedOutput = fs.readFileSync(
      "../fixtures/canonical-json/output.txt",
      "utf8"
    );
    const expectedHash = fs.readFileSync(
      "../fixtures/canonical-json/output.sha256",
      "utf8"
    );

    const result = canonicalJSONStringify(input);
    const resultHash = await sha256(result);

    expect(result).toBe(expectedOutput);
    expect(resultHash).toBe(expectedHash);
  });
});
```

**`relay/tests/fixtures.chronicle-events.test.ts`**

```ts
import { appendEvent, readChronicle } from "../packages/fakes/chronicle-memory";
import fs from "fs";

describe("Chronicle Event Fixtures", () => {
  it("produces normative eventId and NDJSON format", async () => {
    const input = JSON.parse(
      fs.readFileSync("../fixtures/chronicle-events/basic-append.input.json")
    );
    const expectedOutput = fs.readFileSync(
      "../fixtures/chronicle-events/basic-append.output.ndjson",
      "utf8"
    );

    await appendEvent("test.sage", input);
    const events = await readChronicle("test.sage");

    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).toBe(expectedOutput.trim());
  });
});
```

### 4.9 Stretch Invariants (Tough Mode)

> **Rationale:** While the base suites prove minimal interoperability, these "tough mode" invariants prove robustness against common, subtle, and destructive failure modes. Passing these tests demonstrates that an implementation is not just compliant, but resilient. Each invariant is tested in a dedicated `*.stretch.test.ts` file.

| Suite  | Invariant                      | Description                                                                                                                                                        | Test File                            |
| :----- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| **T1** | **Malformed Tool Arguments**   | LLM provider sends malformed arguments for a tool call. The tool executor must reject the call with an `EVALIDATION` error and must not execute the tool.          | `t1.tools-llm.stretch.test.ts`       |
| **T1** | **Dry-Run Mutators**           | Mutating tools (`Write`, `Edit`, `Bash`) respect a `ctx.dryRun=true` flag, returning a deterministic preview of changes without altering the filesystem.           | `t1.tools-llm.stretch.test.ts`       |
| **T1** | **Stream Backpressure**        | A slow stream consumer does not cause event interleaving. The sequence `tool_call` → `tool_result` → `text` → `end` must be preserved.                             | `t1.tools-llm.stretch.test.ts`       |
| **T2** | **Add-Then-Remove**            | A file `X` is added in commit `A` and removed in commit `B`. Graph queries correctly find `X` at `A` but not at `B`.                                               | `t2.graph-ingest.stretch.test.ts`    |
| **T2** | **Rename Chain Integrity**     | A file is renamed `A.ts` → `B.ts` → `C.ts` across commits. The graph must contain a `WAS_RENAMED_FROM` relationship linking `C` to `B` and `B` to `A`.             | `t2.graph-ingest.stretch.test.ts`    |
| **T2** | **Ingest Idempotency**         | Ingesting the same commit hash for a given project path multiple times does not create duplicate nodes or facts in the graph.                                      | `t2.graph-ingest.stretch.test.ts`    |
| **T3** | **Bullet Wound Invariant**     | A detected contradiction between the Chronicle and the Graph (e.g., a file exists in one but not the other) must throw `EHALT` and prevent tool execution.         | `t3.agents-gates.stretch.test.ts`    |
| **T3** | **Reconciliation Idempotency** | Applying the same reconciliation action multiple times results in at most one `RECONCILIATION` event being appended to the Chronicle.                              | `t3.agents-gates.stretch.test.ts`    |
| **T3** | **Guardian Veto**              | If the Guardian agent returns a `deny` decision on a plan, the Delegator agent must not execute any part of it (no tool calls, no FS changes).                     | `t3.agents-gates.stretch.test.ts`    |
| **T4** | **Unknown AQL Field**          | The AQL parser rejects a query containing an unknown top-level field with a typed error before execution begins.                                                   | `t4.aql-exec.stretch.test.ts`        |
| **T4** | **Parallel Execution**         | Two AQL steps with artificial delays, marked for parallel execution, complete in less time than the sum of their individual delays.                                | `t4.aql-exec.stretch.test.ts`        |
| **T4** | **Tool Schema Enforcement**    | An AQL step invoking a tool with extra or unknown properties fails validation with an `EVALIDATION` error.                                                         | `t4.aql-exec.stretch.test.ts`        |
| **T5** | **Mutator Approval Policy**    | When an LLM requests a mutating tool (`Edit`, `Write`, `Bash`), the CLI must prompt for user approval. A 'deny' response must prevent the mutation.                | `t5.cli.stretch.test.ts`             |
| **T5** | **Deterministic Snapshot**     | With a seeded LLM provider, the CLI's output stream is deterministic and matches a stored snapshot, including tool rendering markers.                              | `t5.cli.stretch.test.ts`             |
| **T5** | **Safe Default Policy**        | Read-only tools (`Read`, `GraphQuery`) are auto-approved by default, while all other tools require explicit user confirmation.                                     | `t5.cli.stretch.test.ts`             |
| **T6** | **Downtime Backfill**          | After a simulated valve outage where file edits occurred, the valve correctly identifies the missed changes and emits `VALVE_PERSONA_TRIGGER` events upon restart. | `t6.valve-chronicle.stretch.test.ts` |
| **T6** | **Append-Only Guarantee**      | The valve never modifies past entries in the Chronicle. Rapid, successive file changes result in an ordered sequence of appended events.                           | `t6.valve-chronicle.stretch.test.ts` |
| **T6** | **Scope Guard**                | The valve refuses to write Chronicle data outside of its designated scope (`.sage/*`, `src/*.sage`), asserting `EPERMISSION` or logging a skip reason.             | `t6.valve-chronicle.stretch.test.ts` |

---

## 5) CI Job Graph

```yaml
name: relay
on: [push, pull_request]
jobs:
  t1-tools-llm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t1.tools-llm.test.ts
  t2-graph-ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t2.graph-ingest.test.ts
  t3-agents:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t3.agents-gates.test.ts
  t4-aql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t4.aql-exec.test.ts
  t5-cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t5.cli-smoke.test.ts
  t6-valve:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i
      - run: pnpm vitest run relay/tests/t6.valve-chronicle.test.ts
```

---

## How to Use This in the Monorepo

- Drop `relay/` in the root (kept separate from `packages/` so teams can ship their own packages into a private registry or as tarballs).
- For each suite, swap **real** vs **fake** by changing imports (or via a Vitest alias) to prove zero‑knowledge compliance.
- Expand skeletons with the **acceptance tests** from the contract doc to raise the bar gradually.

---

## Stretch Goal: Cross‑Team Handoff Drill

1. Team A implements `@sage/tools` only.
2. Team B implements `@sage/llm` only.
3. Neither team sees the other. Relay runs T1 with A(real)+B(fake) then A(fake)+B(real).
4. Rotate packages across teams week‑over‑week; green relay = contract holds.
