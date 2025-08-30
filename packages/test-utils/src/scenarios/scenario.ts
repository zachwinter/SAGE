import type { 
  TempWorkspace,
  GraphAdapter,
  ChronicleAdapter, 
  LLMClient,
  ToolRegistry
} from "../index.js";
import {
  createTempWorkspace,
  makeGraphAdapter,
  makeChronicle,
  makeLLM,
  makeTools
} from "../index.js";
import type { 
  ScenarioContext,
  Plan,
  Approve, 
  Deny,
  Agent,
  Guardian,
  Delegator,
  Sage,
  ExecutionReport
} from "./types.js";

/**
 * Fluent scenario builder for agent testing
 */
export class Scenario {
  private context: Partial<ScenarioContext> = {};
  private _workspace?: TempWorkspace;
  private _graph?: GraphAdapter;
  private _chronicle?: ChronicleAdapter;
  private _llm?: LLMClient;
  private _tools?: ToolRegistry;
  private _clock: { now(): string };
  private workspaceSetup?: (ws: { file(path: string, content: string): Promise<void>; }) => Promise<void>;

  constructor() {
    this._clock = { now: () => new Date().toISOString() };
  }

  /**
   * Set up workspace with files
   */
  withWorkspace(
    setup?: (ws: {
      file(path: string, content: string): Promise<void>;
    }) => Promise<void>
  ): this {
    this._workspace = null as any; // Will be created lazily
    this.workspaceSetup = setup;
    return this;
  }

  /**
   * Add graph adapter
   */
  withGraph(): this {
    this._graph = makeGraphAdapter();
    return this;
  }

  /**
   * Add chronicle adapter with optional clock
   */
  withChronicle(options: { clock?: { now(): string } } = {}): this {
    this._chronicle = makeChronicle({ 
      clock: options.clock || this._clock 
    });
    return this;
  }

  /**
   * Add LLM client with seeded behavior
   */
  withLLM(options: { seed?: number; tools?: Record<string, (i: any) => Promise<any>> } = {}): this {
    this._llm = makeLLM(options);
    return this;
  }

  /**
   * Add tools registry
   */
  withTools(options: { readOnly?: boolean } = {}): this {
    this._tools = makeTools(options);
    return this;
  }

  /**
   * Add Guardian agent for specific file
   */
  withGuardian(filePath: string): this {
    const guardian = new TestGuardian(filePath, this);
    this.context.agents = this.context.agents || new Map();
    this.context.agents.set(`guardian:${filePath}`, guardian);
    return this;
  }

  /**
   * Add Delegator agent
   */
  withDelegator(): this {
    const delegator = new TestDelegator(this);
    this.context.agents = this.context.agents || new Map();
    this.context.agents.set("delegator", delegator);
    return this;
  }

  /**
   * Add Sage agent
   */  
  withSage(): this {
    const sage = new TestSage(this);
    this.context.agents = this.context.agents || new Map();
    this.context.agents.set("sage", sage);
    return this;
  }

  /**
   * Get Guardian agent for file
   */
  guardian(filePath: string): Guardian {
    const agent = this.context.agents?.get(`guardian:${filePath}`);
    if (!agent || agent.type !== "guardian") {
      throw new Error(`Guardian for ${filePath} not found. Use withGuardian(\"${filePath}\") first.`);
    }
    return agent as Guardian;
  }

  /**
   * Get Delegator agent
   */
  get delegator(): Delegator {
    const agent = this.context.agents?.get("delegator");
    if (!agent || agent.type !== "delegator") {
      throw new Error("Delegator not found. Use withDelegator() first.");
    }
    return agent as Delegator;
  }

  /**
   * Get Sage agent
   */
  get sage(): Sage {
    const agent = this.context.agents?.get("sage");
    if (!agent || agent.type !== "sage") {
      throw new Error("Sage not found. Use withSage() first.");
    }
    return agent as Sage;
  }

  /**
   * Helper: Sage drafts a plan
   */
  async sageDraftPlan(options: { goal: string }): Promise<Plan> {
    const sageAgent = this.sage;
    const ideation = await sageAgent.ideate(options);
    return await sageAgent.draftPlan({ 
      options: ideation.options,
      goal: options.goal
    });
  }

  /**
   * Expectation helper for Chronicle events
   */
  expectChronicle(path: string) {
    return {
      toContainEvent: async (match: Partial<any>) => {
        const chronicle = await this.getChronicle();
        const events = await chronicle.read(path);
        
        const matchingEvent = events.find(event => {
          return Object.entries(match).every(([key, value]) => 
            event[key] === value
          );
        });
        
        if (!matchingEvent) {
          throw new Error(
            `Expected chronicle ${path} to contain event matching ${JSON.stringify(match)}, ` +
            `but found: ${JSON.stringify(events.map(e => ({ type: e.type, ...e })))}`
          );
        }
      },

      toContainEventSequence: async (sequence: Partial<any>[]) => {
        const chronicle = await this.getChronicle();
        const events = await chronicle.read(path);
        
        let sequenceIndex = 0;
        for (const event of events) {
          if (sequenceIndex >= sequence.length) break;
          
          const expectedEvent = sequence[sequenceIndex];
          const matches = Object.entries(expectedEvent).every(([key, value]) => 
            event[key] === value
          );
          
          if (matches) {
            sequenceIndex++;
          }
        }
        
        if (sequenceIndex < sequence.length) {
          throw new Error(
            `Expected event sequence not found. Found ${sequenceIndex}/${sequence.length} events in order.`
          );
        }
      }
    };
  }

  /**
   * Expectation helper for Graph queries
   */
  expectGraph(query: string, params?: Record<string, any>) {
    return {
      toReturn: async (expectedRows: any[]) => {
        const graph = await this.getGraph();
        const actualRows = await graph.query(query, params);
        
        if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) {
          throw new Error(
            `Graph query did not return expected results.\\n` +
            `Expected: ${JSON.stringify(expectedRows)}\\n` +
            `Actual: ${JSON.stringify(actualRows)}`
          );
        }
      },

      toReturnCount: async (expectedCount: number) => {
        const graph = await this.getGraph();
        const rows = await graph.query(query, params);
        
        if (rows.length !== expectedCount) {
          throw new Error(
            `Expected ${expectedCount} results, but got ${rows.length}`
          );
        }
      }
    };
  }

  /**
   * Flush any pending daemon events (simulation)
   */
  async flushDaemons(): Promise<void> {
    // In a real implementation, this would trigger daemon event processing
    // For testing, we can simulate file change events
    const chronicle = await this.getChronicle();
    
    // Simulate a ROGUE_EDIT_DETECTED event
    await chronicle.append(".sage/daemon.sage", {
      type: "DAEMON_FLUSH",
      timestamp: this._clock.now(),
      actor: { agent: "daemon", id: "system" }
    });
  }

  // Private helpers to get initialized services
  async getWorkspace(): Promise<TempWorkspace> {
    if (!this._workspace) {
      this._workspace = await createTempWorkspace();
      
      // Run workspace setup if provided
      if (this.workspaceSetup) {
        await this.workspaceSetup(this._workspace);
      }
    }
    return this._workspace;
  }

  async getGraph(): Promise<GraphAdapter> {
    if (!this._graph) {
      this._graph = makeGraphAdapter();
    }
    return this._graph;
  }

  async getChronicle(): Promise<ChronicleAdapter> {
    if (!this._chronicle) {
      this._chronicle = makeChronicle({ clock: this._clock });
    }
    return this._chronicle;
  }

  async getLLM(): Promise<LLMClient> {
    if (!this._llm) {
      this._llm = makeLLM({ seed: 42 });
    }
    return this._llm;
  }

  async getTools(): Promise<ToolRegistry> {
    if (!this._tools) {
      this._tools = makeTools();
    }
    return this._tools;
  }
}

// Test implementations of SAGE agents

class TestGuardian implements Guardian {
  public readonly type = "guardian" as const;
  public readonly id: string;
  public readonly filePath: string;

  constructor(filePath: string, private scenario: Scenario) {
    this.filePath = filePath;
    this.id = `guardian:${filePath}`;
  }

  async reviewPlan(plan: Plan): Promise<Approve | Deny> {
    // Simple approval logic for testing
    // Real guardian would analyze plan safety
    if (plan.steps.some(step => step.type === "bash" && step.args.command?.includes("rm"))) {
      return {
        type: "deny",
        reason: "Plan contains potentially destructive bash commands",
        suggestions: ["Use safer file operations", "Add explicit safeguards"]
      };
    }

    if (plan.steps.length > 10) {
      return {
        type: "deny", 
        reason: "Plan is too complex, break into smaller plans",
        suggestions: ["Split into multiple phases"]
      };
    }

    return {
      type: "approve",
      justification: "Plan appears safe and well-structured",
      conditions: ["Must run in staging first"]
    };
  }

  async reconcile(edit: { filePath: string; diffRef: string }): Promise<{ ok: boolean }> {
    const chronicle = await this.scenario.getChronicle();
    
    // Record reconciliation event
    await chronicle.append(`${this.filePath}.sage`, {
      type: "RECONCILIATION",
      filePath: edit.filePath,
      diffRef: edit.diffRef,
      timestamp: new Date().toISOString(),
      actor: { agent: "guardian", id: this.filePath }
    });

    return { ok: true };
  }
}

class TestDelegator implements Delegator {
  public readonly type = "delegator" as const;
  public readonly id = "delegator";

  constructor(private scenario: Scenario) {}

  async execute(plan: Plan): Promise<ExecutionReport> {
    const startTime = Date.now();
    const tools = await this.scenario.getTools();
    
    try {
      let executedSteps = 0;
      const results: Record<string, any> = {};

      for (const step of plan.steps) {
        // Execute step using appropriate tool
        const tool = tools.get(step.tool);
        const validatedArgs = tool.validate(step.args);
        const result = await tool.execute(validatedArgs, { cwd: "/tmp" });

        if (!result.ok) {
          return {
            ok: false,
            planId: plan.id,
            executedSteps,
            totalSteps: plan.steps.length,
            error: {
              code: result.error?.code || "EXECUTION_FAILED",
              message: result.error?.message || "Step execution failed",
              step: step.id
            },
            duration: Date.now() - startTime
          };
        }

        results[step.id] = result.data;
        executedSteps++;
      }

      // Record successful execution
      const chronicle = await this.scenario.getChronicle();
      await chronicle.append(".sage/delegator.sage", {
        type: "PLAN_EXECUTED",
        planId: plan.id,
        steps: executedSteps,
        timestamp: new Date().toISOString(),
        actor: { agent: "delegator", id: "system" }
      });

      return {
        ok: true,
        planId: plan.id,
        executedSteps,
        totalSteps: plan.steps.length,
        results,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        ok: false,
        planId: plan.id,
        executedSteps: 0,
        totalSteps: plan.steps.length,
        error: {
          code: "EXECUTION_ERROR",
          message: (error as Error).message
        },
        duration: Date.now() - startTime
      };
    }
  }
}

class TestSage implements Sage {
  public readonly type = "sage" as const;
  public readonly id = "sage";

  constructor(private scenario: Scenario) {}

  async ideate(input: { goal: string }): Promise<{ options: string[] }> {
    // Generate options based on goal keywords
    const goal = input.goal.toLowerCase();
    const options: string[] = [];

    if (goal.includes("rename") || goal.includes("refactor")) {
      options.push("Use Edit tool to apply systematic renaming");
      options.push("Create new files and remove old ones");
      options.push("Use bash tools for bulk renaming");
    }

    if (goal.includes("implement") || goal.includes("create") || goal.includes("add")) {
      options.push("Create new implementation from scratch");
      options.push("Extend existing code with new functionality");
      options.push("Copy and modify similar existing code");
    }

    if (goal.includes("fix") || goal.includes("bug") || goal.includes("error")) {
      options.push("Analyze error logs and apply targeted fix");
      options.push("Refactor problematic code section");
      options.push("Add additional error handling");
    }

    if (options.length === 0) {
      // Default options for any goal
      options.push("Analyze current state with Read and GraphQuery tools");
      options.push("Make targeted changes with Edit tool");  
      options.push("Verify changes work correctly");
    }

    return { options };
  }

  async draftPlan(ideation: { options: string[]; goal?: string }): Promise<Plan> {
    const planId = `plan-${Date.now()}`;
    const selectedOption = ideation.options[0]; // Use first option for simplicity

    // Generate steps based on selected approach
    const steps = [];
    let stepId = 1;

    // Always start with analysis
    steps.push({
      id: `step-${stepId++}`,
      type: "read" as const,
      description: "Read current state of target files",
      tool: "Read",
      args: { file: "src/main.ts" },
    });

    steps.push({
      id: `step-${stepId++}`,
      type: "query" as const,
      description: "Query graph for related entities",
      tool: "GraphQuery",
      args: { 
        query: "MATCH (n) WHERE n.path CONTAINS $term RETURN n",
        params: { term: "main" }
      },
    });

    // Add implementation steps based on goal
    if (ideation.goal?.includes("rename")) {
      steps.push({
        id: `step-${stepId++}`,
        type: "edit" as const,
        description: "Apply renaming changes",
        tool: "Edit",
        args: { 
          file: "src/main.ts",
          patch: "# Placeholder patch for renaming"
        },
        dependencies: ["step-1"]
      });
    } else {
      steps.push({
        id: `step-${stepId++}`,
        type: "write" as const,
        description: "Write implementation",
        tool: "Write",
        args: { 
          file: "src/output.ts",
          content: "// Generated implementation\\nexport {};"
        },
        dependencies: ["step-1", "step-2"]
      });
    }

    return {
      id: planId,
      summary: `${ideation.goal || "Execute goal"} - ${selectedOption}`,
      steps,
      metadata: {
        goal: ideation.goal,
        estimatedDuration: steps.length * 30 // 30 seconds per step
      }
    };
  }
}

/**
 * Create a new scenario builder
 */
export function scenario(): Scenario {
  return new Scenario();
}