# STORY: AQL Integration for Multi-Agent Workflows

## Overview
Implement the Agent Query Language (AQL) system to enable declarative, complex multi-agent workflows. Transform from imperative agent orchestration to declarative query-based execution that can compose multiple agents, tools, and reasoning steps.

## Current State
After Phase 4, we have:
- ✅ Formal agents implemented (Sage, Guardian, Delegator, Warden, Archivist)
- ✅ Agent protocols working (Bullet Wound, Reconciliation, Transaction Boundary)
- ✅ Chronicle system for agent memory
- ✅ Tool integration with agents
- ❌ No declarative orchestration language
- ❌ Complex workflows still require imperative code
- ❌ No composition of multi-agent reasoning
- ❌ Limited workflow reusability

## Success Criteria
- [ ] AQL language implemented with GraphQL-like syntax
- [ ] AQL compiler converts queries to execution plans
- [ ] Multi-agent workflows can be declared in AQL
- [ ] CLI supports `sage aql run <file.aql>` command
- [ ] Complex reasoning patterns (committees, mediation) in AQL
- [ ] Streaming execution with real-time progress
- [ ] AQL queries integrate with existing agent infrastructure
- [ ] Performance suitable for interactive use

## Implementation Plan

### Step 1: Design AQL Syntax

AQL should be GraphQL-inspired but optimized for agent workflows:

```graphql
# Simple agent query
query AnalyzeFile {
  guardian(file: "src/UserService.ts") {
    selfInquiry {
      findings
      recommendations
    }
  }
}

# Multi-agent workflow  
query RefactorComponent {
  sage {
    ideate(goal: "Extract validation logic to separate module") {
      options {
        description
        complexity
        risk
      }
      plan: draftPlan {
        id
        changes {
          file
          type
          description
        }
      }
    }
  }
  
  # Get reviews from multiple guardians
  reviews: guardians(files: $plan.affectedFiles) {
    reviewPlan(plan: $plan) {
      type
      justification
      reason
    }
  }
  
  # Execute if approved
  execution: delegator @if(condition: $reviews.allApproved) {
    execute(plan: $plan) {
      ok
      results {
        file
        success
        error
      }
    }
  }
}

# Committee formation
query LargeRefactor {
  committee: sage {
    formCommittee(affectedFiles: ["src/**/*.ts"]) {
      chair: guardian(file: "src/main.ts")
      members: guardians(pattern: "src/**/*.ts") {
        territory: filePath
      }
    }
  }
  
  consensus: committee.negotiate(plan: $largeRefactorPlan) {
    decision
    dissent {
      agent
      reason
    }
  }
}
```

### Step 2: Create AQL Package Structure

```bash
packages/aql/
├── src/
│   ├── index.ts              # Main exports
│   ├── parser/
│   │   ├── lexer.ts         # Token lexer
│   │   ├── parser.ts        # AST parser
│   │   ├── validator.ts     # Query validation
│   │   └── types.ts         # AST node types
│   ├── compiler/
│   │   ├── Compiler.ts      # Main compiler
│   │   ├── ExecutionPlan.ts # Execution plan types
│   │   ├── Optimizer.ts     # Query optimization
│   │   └── CodeGen.ts       # Code generation
│   ├── runtime/
│   │   ├── Executor.ts      # Query executor
│   │   ├── Scheduler.ts     # Parallel execution
│   │   ├── Cache.ts         # Result caching
│   │   └── Stream.ts        # Streaming results
│   ├── resolvers/
│   │   ├── AgentResolver.ts # Agent field resolution
│   │   ├── ToolResolver.ts  # Tool field resolution
│   │   └── GraphResolver.ts # Graph data resolution
│   ├── directives/
│   │   ├── IfDirective.ts   # Conditional execution
│   │   ├── ParallelDirective.ts # Parallel execution
│   │   └── CacheDirective.ts # Result caching
│   └── types/
│       ├── schema.ts        # AQL schema types
│       ├── execution.ts     # Execution context
│       └── resolvers.ts     # Resolver interfaces
├── schemas/                 # AQL schema definitions
│   ├── agents.graphql       # Agent schema
│   ├── tools.graphql        # Tools schema  
│   └── base.graphql         # Base types
├── examples/                # Example AQL queries
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Step 3: Implement AQL Parser

```typescript
// parser/types.ts
export interface AQLQuery {
  kind: "Query";
  name: string;
  selections: Selection[];
  variables: Variable[];
}

export interface AgentSelection {
  kind: "Agent";
  name: string; // "sage", "guardian", etc.
  arguments: Argument[];
  selections: Selection[];
  directives: Directive[];
}

export interface ToolSelection {
  kind: "Tool";
  name: string; // "Read", "Write", etc.
  arguments: Argument[];
  directives: Directive[];
}

// parser/parser.ts
export class AQLParser {
  parse(source: string): AQLQuery {
    const tokens = this.lexer.tokenize(source);
    return this.parseQuery(tokens);
  }
  
  private parseQuery(tokens: Token[]): AQLQuery {
    // GraphQL-style parsing logic
    // Handle query, selections, arguments, directives
  }
}
```

### Step 4: Implement AQL Compiler

```typescript
// compiler/Compiler.ts
export class AQLCompiler {
  compile(query: AQLQuery): ExecutionPlan {
    // Analyze dependencies between selections
    const graph = this.buildDependencyGraph(query);
    
    // Optimize execution order
    const optimized = this.optimizer.optimize(graph);
    
    // Generate execution plan
    return this.generatePlan(optimized);
  }
  
  private generatePlan(graph: DependencyGraph): ExecutionPlan {
    const steps: ExecutionStep[] = [];
    
    // Topological sort for execution order
    const sorted = this.topologicalSort(graph);
    
    for (const node of sorted) {
      if (node.kind === "Agent") {
        steps.push({
          type: "agent",
          agent: node.name,
          method: node.method,
          inputs: this.resolveInputs(node),
          parallel: node.directives.includes("parallel")
        });
      } else if (node.kind === "Tool") {
        steps.push({
          type: "tool", 
          tool: node.name,
          inputs: this.resolveInputs(node)
        });
      }
    }
    
    return { steps, variables: query.variables };
  }
}
```

### Step 5: Implement AQL Runtime

```typescript
// runtime/Executor.ts
export class AQLExecutor {
  constructor(
    private agents: AgentRegistry,
    private tools: ToolRegistry,
    private graph: GraphAdapter,
    private chronicle: ChronicleAdapter
  ) {}

  async *execute(plan: ExecutionPlan): AsyncIterableIterator<ExecutionEvent> {
    const context = new ExecutionContext(plan.variables);
    
    for (const step of plan.steps) {
      yield { type: "step_start", step: step.id };
      
      try {
        const result = await this.executeStep(step, context);
        context.setResult(step.id, result);
        yield { type: "step_complete", step: step.id, result };
      } catch (error) {
        yield { type: "step_error", step: step.id, error };
        throw error;
      }
    }
    
    yield { type: "query_complete", results: context.getAllResults() };
  }
  
  private async executeStep(step: ExecutionStep, context: ExecutionContext): Promise<any> {
    switch (step.type) {
      case "agent":
        return this.executeAgentStep(step, context);
      case "tool":
        return this.executeToolStep(step, context);
      case "parallel":
        return this.executeParallelStep(step, context);
    }
  }
  
  private async executeAgentStep(step: AgentStep, context: ExecutionContext): Promise<any> {
    const agent = this.agents.get(step.agent);
    const method = agent[step.method];
    const inputs = this.resolveInputs(step.inputs, context);
    
    return await method.call(agent, inputs);
  }
}
```

### Step 6: Agent Resolvers and Schema

```graphql
# schemas/agents.graphql
type Sage {
  ideate(goal: String!): Ideation
  draftPlan(ideation: Ideation!): Plan  
  mediate(reviews: [Review!]!): MediationResult
}

type Guardian {
  reviewPlan(plan: Plan!): Review
  reconcile(edit: RogueEdit!): ReconciliationOutcome
  selfInquiry: SelfInquiryReport
  bulletWoundCheck(assertions: [Assertion!]!): Boolean
}

type Delegator {
  execute(plan: Plan!): ExecutionReport
}

type Query {
  sage: Sage
  guardian(file: String!): Guardian
  guardians(files: [String!], pattern: String): [Guardian!]!
  delegator: Delegator
  warden: Warden
  archivist: Archivist
}
```

```typescript
// resolvers/AgentResolver.ts
export const agentResolvers = {
  Query: {
    sage: () => new Sage(dependencies),
    guardian: (_, { file }) => new Guardian(file, dependencies),
    guardians: async (_, { files, pattern }) => {
      const fileList = pattern 
        ? await glob(pattern) 
        : files;
      return fileList.map(file => new Guardian(file, dependencies));
    },
    delegator: () => new Delegator(dependencies)
  },
  
  Sage: {
    ideate: (sage, { goal }) => sage.ideate({ goal }),
    draftPlan: (sage, { ideation }) => sage.draftPlan(ideation),
    mediate: (sage, { reviews }) => sage.mediate(reviews)
  },
  
  Guardian: {
    reviewPlan: (guardian, { plan }) => guardian.reviewPlan(plan),
    reconcile: (guardian, { edit }) => guardian.reconcile(edit),
    selfInquiry: (guardian) => guardian.selfInquiry(),
    bulletWoundCheck: (guardian, { assertions }) => guardian.bulletWoundCheck(assertions)
  }
};
```

### Step 7: CLI Integration

Add AQL support to CLI:

```typescript
// commands/aql.ts
export async function aql(args: string[]) {
  const [subcommand, ...rest] = args;
  
  switch (subcommand) {
    case "run":
      return await runAQLFile(rest[0]);
    case "query":
      return await runAQLQuery(rest.join(" "));
    case "validate":
      return await validateAQL(rest[0]);
  }
}

async function runAQLFile(filePath: string) {
  const source = await fs.readFile(filePath, 'utf-8');
  const parser = new AQLParser();
  const compiler = new AQLCompiler();
  const executor = new AQLExecutor(agents, tools, graph, chronicle);
  
  try {
    const query = parser.parse(source);
    const plan = compiler.compile(query);
    
    console.log(`🚀 Executing AQL query: ${query.name}`);
    
    for await (const event of executor.execute(plan)) {
      switch (event.type) {
        case "step_start":
          console.log(`  ⚡ Starting step: ${event.step}`);
          break;
        case "step_complete":
          console.log(`  ✅ Completed: ${event.step}`);
          console.log(`     Result:`, JSON.stringify(event.result, null, 2));
          break;
        case "step_error":
          console.log(`  ❌ Error in step: ${event.step}`);
          console.log(`     Error:`, event.error.message);
          break;
      }
    }
  } catch (error) {
    console.error("❌ AQL execution failed:", error.message);
  }
}
```

### Step 8: Advanced AQL Features

#### Conditional Execution
```graphql
query ConditionalRefactor {
  analysis: guardian(file: "src/complex.ts") {
    complexity: selfInquiry {
      complexity
    }
  }
  
  refactor: sage @if(condition: "$analysis.complexity > 0.8") {
    ideate(goal: "Reduce complexity") {
      plan: draftPlan {
        changes
      }
    }
  }
}
```

#### Parallel Agent Execution
```graphql
query ParallelAnalysis {
  # Run multiple guardians in parallel
  analysis: guardians(pattern: "src/**/*.ts") @parallel {
    file: filePath
    issues: selfInquiry {
      findings
    }
  }
  
  # Aggregate results
  summary: sage {
    summarize(reports: $analysis) {
      totalIssues
      highPriority
      recommendations
    }
  }
}
```

#### Committee Workflows
```graphql
query CommitteeDecision {
  # Form committee for large change
  committee: sage {
    charter(scope: "authentication system") {
      chair: guardian(file: "src/auth/main.ts")
      members: guardians(pattern: "src/auth/**/*.ts")
    }
  }
  
  # Negotiate consensus
  decision: committee.negotiate(proposal: $authRefactor) {
    consensus
    approvals {
      agent
      justification
    }
    dissent {
      agent
      concerns
    }
  }
}
```

## Files to Change

### New Files
- `packages/aql/` (entire package)
- `apps/cli/src/commands/aql.ts` (new command)

### Modified Files
- `apps/cli/src/index.tsx` (add aql command)
- `apps/cli/package.json` (add @sage/aql dependency)

### CLI Command Integration
```typescript
// Update main CLI router
if (args[0] === "aql") {
  await aql(args.slice(1));
}
```

## Risk Mitigation
- **High Risk**: Complex new language implementation
- **Medium Risk**: Performance of complex queries
- **Low Risk**: Integration with existing agents
- **Mitigation**: Incremental implementation, extensive testing, performance monitoring

## Dependencies
- `@sage/agents` for agent orchestration
- `@sage/tools` for tool execution
- `@sage/graph` for graph queries
- `@sage/chronicle` for logging
- `@sage/llm` for agent reasoning

## Success Validation
1. `sage aql run query.aql` works for simple queries
2. Multi-agent workflows execute correctly
3. Parallel execution improves performance
4. Conditional logic works as expected
5. Error handling provides clear diagnostics  
6. Performance is acceptable for interactive use
7. AQL syntax is learnable and expressive

## Future Possibilities
- AQL query optimization and caching
- Visual AQL query builder
- AQL query libraries and templates
- Integration with external workflows (GitHub Actions, CI/CD)
- Real-time collaborative AQL editing