import { describe, it, expect } from "vitest";
import { scenario } from "../scenarios/index.js";

describe("Story 3: Agent Scenario DSL & Harnesses", () => {
  describe("Scenario Builder", () => {
    it("supports fluent API for scenario setup", async () => {
      const sc = scenario()
        .withWorkspace()
        .withGraph()
        .withChronicle()
        .withLLM({ seed: 42 })
        .withTools({ readOnly: false })
        .withGuardian("src/test.ts")
        .withDelegator()
        .withSage();

      // Verify internal state is set up
      expect(sc).toBeDefined();
      expect(typeof sc.guardian).toBe("function");
      expect(typeof sc.delegator).toBe("object");
      expect(typeof sc.sage).toBe("object");
    });

    it("creates workspace with file setup", async () => {
      const sc = await scenario()
        .withWorkspace(async (ws) => {
          await ws.file("src/App.ts", "export const App = () => {};");
          await ws.file("package.json", '{"name": "test"}');
        })
        .withGraph()
        .withChronicle();

      const workspace = await (sc as any).getWorkspace();
      const tree = await workspace.tree();
      
      expect(tree).toHaveProperty("src/App.ts");
      expect(tree).toHaveProperty("package.json");
      expect(tree["src/App.ts"]).toBe("export const App = () => {};");
    });

    it("throws error when accessing agents before setup", () => {
      const sc = scenario();
      
      expect(() => sc.guardian("test.ts")).toThrow("Guardian for test.ts not found");
      expect(() => sc.delegator).toThrow("Delegator not found");
      expect(() => sc.sage).toThrow("Sage not found");
    });
  });

  describe("Guardian Agent", () => {
    it("approves safe plans", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/test.ts");

      const guardian = sc.guardian("src/test.ts");
      
      const safePlan = {
        id: "safe-plan",
        summary: "Read and analyze files",
        steps: [
          {
            id: "step1",
            type: "read" as const,
            description: "Read source file", 
            tool: "Read",
            args: { file: "src/test.ts" }
          }
        ]
      };

      const decision = await guardian.reviewPlan(safePlan);
      
      expect(decision.type).toBe("approve");
      expect(decision).toHaveProperty("justification");
    });

    it("denies dangerous plans", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/test.ts");

      const guardian = sc.guardian("src/test.ts");
      
      const dangerousPlan = {
        id: "dangerous-plan",
        summary: "Delete all files",
        steps: [
          {
            id: "step1",
            type: "bash" as const,
            description: "Remove all files",
            tool: "Bash", 
            args: { command: "rm", args: ["-rf", "/"] }
          }
        ]
      };

      const decision = await guardian.reviewPlan(dangerousPlan);
      
      expect(decision.type).toBe("deny");
      if (decision.type === "deny") {
        expect(decision).toHaveProperty("reason");
      }
    });

    it("denies overly complex plans", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/test.ts");

      const guardian = sc.guardian("src/test.ts");
      
      // Create a plan with too many steps
      const complexPlan = {
        id: "complex-plan",
        summary: "Complex multi-step plan",
        steps: Array.from({ length: 15 }, (_, i) => ({
          id: `step${i + 1}`,
          type: "read" as const,
          description: `Step ${i + 1}`,
          tool: "Read",
          args: { file: `file${i}.ts` }
        }))
      };

      const decision = await guardian.reviewPlan(complexPlan);
      
      expect(decision.type).toBe("deny");
      if (decision.type === "deny") {
        expect(decision.reason).toContain("too complex");
      }
    });

    it("performs reconciliation", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/test.ts");

      const guardian = sc.guardian("src/test.ts");
      
      const result = await guardian.reconcile({
        filePath: "src/test.ts",
        diffRef: "blob:abc123"
      });

      expect(result.ok).toBe(true);

      // Check that reconciliation was recorded
      await sc.expectChronicle("src/test.ts.sage").toContainEvent({
        type: "RECONCILIATION"
      });
    });
  });

  describe("Delegator Agent", () => {
    it("executes simple plans successfully", async () => {
      const sc = scenario()
        .withWorkspace()
        .withTools({ readOnly: false })
        .withDelegator();

      const delegator = sc.delegator;
      
      const simplePlan = {
        id: "simple-plan",
        summary: "Read a file",
        steps: [
          {
            id: "step1",
            type: "read" as const,
            description: "Read test file",
            tool: "Read",
            args: { file: "test.ts" }
          }
        ]
      };

      const report = await delegator.execute(simplePlan);
      
      expect(report.ok).toBe(true);
      expect(report.planId).toBe("simple-plan");
      expect(report.executedSteps).toBe(1);
      expect(report.totalSteps).toBe(1);
      expect(report.results).toHaveProperty("step1");
    });

    it("handles tool execution failures", async () => {
      const sc = scenario()
        .withWorkspace()
        .withTools({ readOnly: true }) // This will make Write tool fail
        .withDelegator();

      const delegator = sc.delegator;
      
      const failingPlan = {
        id: "failing-plan", 
        summary: "Try to write in read-only mode",
        steps: [
          {
            id: "step1",
            type: "write" as const,
            description: "Write file",
            tool: "Write", 
            args: { file: "output.ts", content: "test" }
          }
        ]
      };

      const report = await delegator.execute(failingPlan);
      
      expect(report.ok).toBe(false);
      expect(report.error?.code).toBe("EPERMISSION");
      expect(report.executedSteps).toBe(0);
    });

    it("executes multi-step plans", async () => {
      const sc = scenario()
        .withWorkspace()
        .withTools({ readOnly: false })
        .withDelegator();

      const delegator = sc.delegator;
      
      const multiStepPlan = {
        id: "multi-step-plan",
        summary: "Read then write",
        steps: [
          {
            id: "step1",
            type: "read" as const,
            description: "Read input file",
            tool: "Read",
            args: { file: "input.ts" }
          },
          {
            id: "step2", 
            type: "write" as const,
            description: "Write output file",
            tool: "Write",
            args: { file: "output.ts", content: "processed content" }
          }
        ]
      };

      const report = await delegator.execute(multiStepPlan);
      
      expect(report.ok).toBe(true);
      expect(report.executedSteps).toBe(2);
      expect(report.results).toHaveProperty("step1");
      expect(report.results).toHaveProperty("step2");
    });

    it("records execution in chronicle", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withTools({ readOnly: false })
        .withDelegator();

      const delegator = sc.delegator;
      
      const plan = {
        id: "recorded-plan",
        summary: "Test plan",
        steps: [
          {
            id: "step1",
            type: "read" as const,
            description: "Read file",
            tool: "Read",
            args: { file: "test.ts" }
          }
        ]
      };

      await delegator.execute(plan);

      // Check execution was recorded
      await sc.expectChronicle(".sage/delegator.sage").toContainEvent({
        type: "PLAN_EXECUTED",
        planId: "recorded-plan"
      });
    });
  });

  describe("Sage Agent", () => {
    it("generates ideation options based on goal", async () => {
      const sc = scenario()
        .withWorkspace()
        .withSage();

      const sage = sc.sage;
      
      const ideation = await sage.ideate({ 
        goal: "rename function from oldName to newName" 
      });

      expect(ideation.options).toBeDefined();
      expect(Array.isArray(ideation.options)).toBe(true);
      expect(ideation.options.length).toBeGreaterThan(0);
      
      // Should contain rename-specific options
      const optionsText = ideation.options.join(" ");
      expect(optionsText.toLowerCase()).toMatch(/rename|edit|refactor/);
    });

    it("drafts plans from ideation", async () => {
      const sc = scenario()
        .withWorkspace()
        .withSage();

      const sage = sc.sage;
      
      const ideation = await sage.ideate({
        goal: "implement new feature"
      });
      
      const plan = await sage.draftPlan({
        options: ideation.options,
        goal: "implement new feature"
      });

      expect(plan).toBeDefined();
      expect(plan).toHaveProperty("id");
      expect(plan).toHaveProperty("summary");
      expect(plan).toHaveProperty("steps");
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);
      
      // Should have analysis steps
      expect(plan.steps[0].tool).toBe("Read");
      expect(plan.steps[1].tool).toBe("GraphQuery");
    });

    it("generates different plans for different goals", async () => {
      const sc = scenario()
        .withWorkspace()
        .withSage();

      const sage = sc.sage;
      
      const renameIdeation = await sage.ideate({
        goal: "rename variable from old to new"
      });
      const renamePlan = await sage.draftPlan({
        options: renameIdeation.options,
        goal: "rename variable"
      });

      const createIdeation = await sage.ideate({
        goal: "create new component"  
      });
      const createPlan = await sage.draftPlan({
        options: createIdeation.options,
        goal: "create new component"
      });

      expect(renamePlan.summary).not.toBe(createPlan.summary);
      // Rename plan should use Edit tool, create plan should use Write tool
      const renameHasEdit = renamePlan.steps.some(s => s.tool === "Edit");
      const createHasWrite = createPlan.steps.some(s => s.tool === "Write");
      
      expect(renameHasEdit).toBe(true);
      expect(createHasWrite).toBe(true);
    });
  });

  describe("Complete Workflows", () => {
    it("executes full Plan/Approve/Execute workflow", async () => {
      const sc = scenario()
        .withWorkspace(async (ws) => {
          await ws.file("src/App.ts", "export const App = () => {};");
        })
        .withGraph()
        .withChronicle()
        .withLLM({ seed: 7 })
        .withTools({ readOnly: false })
        .withGuardian("src/App.ts")
        .withDelegator()
        .withSage();

      // 1. Sage drafts plan
      const plan = await sc.sageDraftPlan({ 
        goal: "analyze App component" 
      });
      
      // 2. Guardian reviews plan
      const review = await sc.guardian("src/App.ts").reviewPlan(plan);
      
      // 3. If approved, execute with Delegator
      if (review.type === "approve") {
        const report = await sc.delegator.execute(plan);
        expect(report.ok).toBe(true);
      }
      
      expect(plan).toBeDefined();
      expect(review).toBeDefined();
    });

    it("handles plan denial gracefully", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/test.ts")
        .withSage();

      // Create plan that will be denied
      const dangerousPlan = {
        id: "dangerous",
        summary: "Delete files",
        steps: Array.from({ length: 12 }, (_, i) => ({ // Too many steps
          id: `step${i}`,
          type: "bash" as const,
          description: "Delete file",
          tool: "Bash",
          args: { command: "rm", args: ["-f", `file${i}.ts`] }
        }))
      };

      const review = await sc.guardian("src/test.ts").reviewPlan(dangerousPlan);
      
      expect(review.type).toBe("deny");
      if (review.type === "deny") {
        expect(review).toHaveProperty("reason");
      }
      
      // Should not execute denied plans
      // This would be enforced by the Delegator in a real system
    });
  });

  describe("Expectation Helpers", () => {
    it("validates Chronicle events", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle();

      const chronicle = await (sc as any).getChronicle();
      await chronicle.append("test.sage", {
        type: "TEST_EVENT",
        data: "test data"
      });

      // Should pass
      await sc.expectChronicle("test.sage").toContainEvent({
        type: "TEST_EVENT"
      });

      // Should fail  
      await expect(
        sc.expectChronicle("test.sage").toContainEvent({
          type: "NONEXISTENT_EVENT"
        })
      ).rejects.toThrow("Expected chronicle test.sage to contain event");
    });

    it("validates Chronicle event sequences", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle();

      const chronicle = await (sc as any).getChronicle();
      await chronicle.append("test.sage", { type: "FIRST" });
      await chronicle.append("test.sage", { type: "SECOND" });
      await chronicle.append("test.sage", { type: "THIRD" });

      // Should pass - events in order
      await sc.expectChronicle("test.sage").toContainEventSequence([
        { type: "FIRST" },
        { type: "SECOND" }
      ]);

      // Should fail - events out of order
      await expect(
        sc.expectChronicle("test.sage").toContainEventSequence([
          { type: "SECOND" },
          { type: "FIRST" }
        ])
      ).rejects.toThrow("Expected event sequence not found");
    });

    it("validates Graph query results", async () => {
      const sc = scenario()
        .withWorkspace()
        .withGraph();

      const graph = await (sc as any).getGraph();
      
      // Add some test data
      await (graph as any).ingest({
        file: "test.ts",
        defines: ["testFn"],
        commit: "abc123"
      });

      // Should pass
      await sc.expectGraph(
        "MATCH (f:Function {name: $name}) RETURN f",
        { name: "testFn" }
      ).toReturnCount(1);

      // Should fail
      await expect(
        sc.expectGraph("MATCH (f:Function) RETURN f").toReturnCount(10)
      ).rejects.toThrow("Expected 10 results, but got");
    });

    it("flushes daemon events", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle();

      await sc.flushDaemons();

      // Should have recorded daemon flush event
      await sc.expectChronicle(".sage/daemon.sage").toContainEvent({
        type: "DAEMON_FLUSH"
      });
    });
  });

  describe("Protocol Testing Scenarios", () => {
    it("simulates Transaction Boundary protocol", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withTools({ readOnly: false }) // Allow staging
        .withGuardian("src/test.ts")
        .withDelegator();

      // Create plan with mutating operations
      const plan = {
        id: "transaction-test",
        summary: "Test transaction boundary",
        steps: [
          {
            id: "step1",
            type: "write" as const,
            description: "Write to staging",
            tool: "Write",
            args: { file: "staging/test.ts", content: "staged content" }
          }
        ]
      };

      // Guardian approves
      const review = await sc.guardian("src/test.ts").reviewPlan(plan);
      expect(review.type).toBe("approve");

      // Delegator executes in staging (simulated)
      const report = await sc.delegator.execute(plan);
      expect(report.ok).toBe(true);

      // In real impl, this would check no files escaped staging before validation
      // For now, we just verify execution succeeded
    });

    it("simulates Reconciliation protocol", async () => {
      const sc = scenario()
        .withWorkspace()
        .withChronicle()
        .withGuardian("src/changed.ts");

      // Simulate rogue edit detection (normally from daemon)
      const chronicle = await (sc as any).getChronicle();
      await chronicle.append("src/changed.ts.sage", {
        type: "ROGUE_EDIT_DETECTED",
        filePath: "src/changed.ts",
        hash: "new-hash"
      });

      // Guardian performs reconciliation
      const result = await sc.guardian("src/changed.ts").reconcile({
        filePath: "src/changed.ts",
        diffRef: "blob:diff123"
      });

      expect(result.ok).toBe(true);

      // Should have reconciliation event recorded
      await sc.expectChronicle("src/changed.ts.sage").toContainEventSequence([
        { type: "ROGUE_EDIT_DETECTED" },
        { type: "RECONCILIATION" }
      ]);
    });
  });
});