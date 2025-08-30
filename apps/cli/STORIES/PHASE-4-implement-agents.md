# STORY: Implement Formal Agents in @sage/agents

## Overview
Transform the CLI's ad-hoc agent-like behaviors into formal implementations of SAGE's archetypal agents (Sage, Guardian, Warden, Delegator, Archivist), replacing implicit patterns with explicit agent protocols and state machines.

## Current State
The CLI has agent-like patterns but no formal agents:
- ✅ Agent orchestration patterns in `act.ts`
- ✅ Tool confirmation system (Guardian-like behavior)
- ✅ Plan-like structures in chat interactions
- ✅ State management for agent interactions
- ❌ No formal agent implementations
- ❌ No agent protocols or state machines
- ❌ No Chronicle integration
- ❌ No agent-to-agent communication

## Success Criteria
- [ ] `@sage/agents` package implements all 5 archetypes
- [ ] Guardian agents created for file protection
- [ ] Sage agent handles ideation and plan drafting
- [ ] Delegator executes plans with transaction boundaries
- [ ] Warden manages infrastructure and permissions
- [ ] Archivist tracks file and directory lineage
- [ ] CLI updated to use formal agents instead of ad-hoc patterns
- [ ] Agent protocols working (Bullet Wound, Reconciliation, etc.)
- [ ] Integration with Chronicle system for agent memory

## Implementation Plan

### Step 1: Create @sage/agents Package Structure
```bash
packages/agents/
├── src/
│   ├── index.ts              # Main exports
│   ├── archetypes/
│   │   ├── Guardian.ts       # File protection agent
│   │   ├── Sage.ts          # Ideation and planning agent  
│   │   ├── Delegator.ts     # Execution and orchestration
│   │   ├── Warden.ts        # Infrastructure and security
│   │   └── Archivist.ts     # Lineage and history
│   ├── protocols/
│   │   ├── BulletWound.ts   # Contradiction detection
│   │   ├── Reconciliation.ts # Rogue edit handling
│   │   ├── Transaction.ts    # Atomic execution boundaries
│   │   └── Unsafe.ts        # Override protocol
│   ├── state-machines/
│   │   ├── GuardianState.ts  # Guardian lifecycle
│   │   ├── DelegatorState.ts # Execution states
│   │   └── base.ts          # Base state machine
│   ├── types/
│   │   ├── agents.ts        # Agent interfaces
│   │   ├── plans.ts         # Plan structures
│   │   ├── decisions.ts     # Approve/Deny types
│   │   └── events.ts        # Agent events
│   └── adapters/
│       ├── GraphAdapter.ts   # @sage/graph integration
│       ├── ChronicleAdapter.ts # @sage/chronicle integration
│       └── ToolsAdapter.ts   # @sage/tools integration
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Step 2: Define Core Agent Interfaces

```typescript
// types/agents.ts
export interface IGuardian {
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  reconcile(edit: RogueEdit): Promise<ReconciliationOutcome>;
  selfInquiry(): Promise<SelfInquiryReport>;
  bulletWoundCheck(assertions: Assertion[]): Promise<void>; // may HALT_AND_REPORT
}

export interface ISage {
  ideate(input: Intent): Promise<Ideation>;
  draftPlan(ideation: Ideation): Promise<Plan>;
  mediate(reviews: ReviewSet): Promise<MediationResult>;
}

export interface IDelegator {
  execute(plan: Plan): Promise<ExecutionReport>;
}

export interface IWarden {
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  promote(build: BuildRef, from: Env, to: Env): Promise<PromotionResult>;
}

export interface IArchivist {
  record(event: LineageEvent): Promise<void>;
  query(q: HistoryQuery): Promise<HistoryAnswer>;
}

// types/decisions.ts
export type Approve = { type: "approve"; justification: string };
export type Deny = { type: "deny"; reason: string };

// types/plans.ts  
export interface Plan {
  id: string;
  goal: string;
  affectedFiles: string[];
  changes: Change[];
  acceptanceCriteria: string[];
  createdBy: string; // agent id
  createdAt: string;
}
```

### Step 3: Implement Guardian Agent

```typescript
// archetypes/Guardian.ts
export class Guardian implements IGuardian {
  constructor(
    private filePath: string,
    private deps: {
      graph: GraphAdapter;
      chronicle: ChronicleAdapter;
      tools: ToolsAdapter;
      llm: LLMClient;
    }
  ) {}

  async reviewPlan(plan: Plan): Promise<Approve | Deny> {
    // Check if plan affects this Guardian's file
    if (!plan.affectedFiles.includes(this.filePath)) {
      return { type: "approve", justification: "Plan does not affect this file" };
    }

    // Perform architectural analysis
    const analysis = await this.analyzeChanges(plan.changes);
    
    // Query LLM for architectural reasoning
    const decision = await this.deps.llm.chat({
      model: "gpt-4",
      messages: [
        { role: "system", content: GUARDIAN_PROMPT },
        { role: "user", content: JSON.stringify({ plan, analysis }) }
      ]
    });

    // Parse structured decision
    return this.parseDecision(decision);
  }

  async reconcile(edit: RogueEdit): Promise<ReconciliationOutcome> {
    // Engage user in dialogue about the change
    const justification = await this.requestJustification(edit);
    
    // Record reconciliation in Chronicle
    await this.deps.chronicle.append(this.chroniclePath, {
      type: "RECONCILIATION",
      timestamp: new Date().toISOString(),
      edit: edit.diffRef,
      justification,
      resolved: true
    });

    return { reconciled: true, justification };
  }

  async bulletWoundCheck(assertions: Assertion[]): Promise<void> {
    for (const assertion of assertions) {
      const result = await this.deps.graph.query(assertion.cypher);
      const hasRows = result.length > 0;
      
      if (assertion.expectRows !== hasRows) {
        // CRITICAL: Contradiction detected
        await this.deps.chronicle.append(this.chroniclePath, {
          type: "HALT_AND_REPORT",
          timestamp: new Date().toISOString(),
          assertion,
          contradiction: true
        });
        
        throw new BulletWoundError(
          `Chronicle-Graph contradiction: ${assertion.description}`
        );
      }
    }
  }

  private get chroniclePath(): string {
    return this.filePath + '.sage';
  }
}
```

### Step 4: Implement Sage Agent

```typescript  
// archetypes/Sage.ts
export class Sage implements ISage {
  constructor(
    private deps: {
      graph: GraphAdapter;
      chronicle: ChronicleAdapter;
      llm: LLMClient;
    }
  ) {}

  async ideate(input: Intent): Promise<Ideation> {
    // Analyze current codebase state
    const context = await this.gatherContext(input);
    
    // LLM ideation with architectural awareness
    const response = await this.deps.llm.chat({
      model: "gpt-4",
      messages: [
        { role: "system", content: SAGE_IDEATION_PROMPT },
        { role: "user", content: JSON.stringify({ input, context }) }
      ]
    });

    return this.parseIdeation(response);
  }

  async draftPlan(ideation: Ideation): Promise<Plan> {
    // Convert ideation into structured plan
    const plan: Plan = {
      id: generateId(),
      goal: ideation.goal,
      affectedFiles: await this.identifyAffectedFiles(ideation),
      changes: await this.specifyChanges(ideation),
      acceptanceCriteria: ideation.acceptanceCriteria,
      createdBy: "sage",
      createdAt: new Date().toISOString()
    };

    // Log plan creation
    await this.deps.chronicle.append('.sage/plans', {
      type: "PLAN_DRAFTED",
      planId: plan.id,
      timestamp: plan.createdAt,
      plan
    });

    return plan;
  }

  async mediate(reviews: ReviewSet): Promise<MediationResult> {
    // Find conflicts between Guardian/Warden reviews
    const conflicts = this.identifyConflicts(reviews);
    
    if (conflicts.length === 0) {
      return { decision: "approve", consensus: true };
    }

    // LLM-assisted conflict resolution
    const resolution = await this.deps.llm.chat({
      model: "gpt-4", 
      messages: [
        { role: "system", content: SAGE_MEDIATION_PROMPT },
        { role: "user", content: JSON.stringify({ reviews, conflicts }) }
      ]
    });

    return this.parseMediation(resolution);
  }
}
```

### Step 5: Implement Delegator Agent

```typescript
// archetypes/Delegator.ts
export class Delegator implements IDelegator {
  constructor(
    private deps: {
      tools: ToolsAdapter;
      chronicle: ChronicleAdapter;
    }
  ) {}

  async execute(plan: Plan): Promise<ExecutionReport> {
    const executionId = generateId();
    
    try {
      // Start transaction boundary
      await this.beginTransaction(executionId, plan);
      
      // Execute each change in the plan
      const results = [];
      for (const change of plan.changes) {
        const result = await this.executeChange(change);
        results.push(result);
        
        // Validate after each change
        if (!result.ok) {
          await this.rollbackTransaction(executionId);
          throw new ExecutionError(result.error);
        }
      }
      
      // Commit transaction
      await this.commitTransaction(executionId);
      
      return {
        ok: true,
        executionId,
        results,
        completedAt: new Date().toISOString()
      };
      
    } catch (error) {
      await this.rollbackTransaction(executionId);
      throw error;
    }
  }

  private async executeChange(change: Change): Promise<ChangeResult> {
    switch (change.type) {
      case "edit":
        return await this.deps.tools.execute("Edit", {
          file: change.file,
          patch: change.patch
        });
      case "create":
        return await this.deps.tools.execute("Write", {
          file: change.file,
          content: change.content
        });
      default:
        throw new Error(`Unknown change type: ${change.type}`);
    }
  }
}
```

### Step 6: Update CLI Integration

Replace ad-hoc patterns with formal agents:

```typescript
// CLI: Create agent instances
const guardians = new Map<string, Guardian>();
const sage = new Sage({ graph, chronicle, llm });
const delegator = new Delegator({ tools, chronicle });

// Replace tool confirmation with Guardian protocol
guardToolCall: async (roundIndex, callId, controller) => {
  const affectedFile = extractFileFromToolCall(controller.toolCallRequest);
  
  if (affectedFile) {
    // Get or create Guardian for file
    let guardian = guardians.get(affectedFile);
    if (!guardian) {
      guardian = new Guardian(affectedFile, { graph, chronicle, tools, llm });
      guardians.set(affectedFile, guardian);
    }
    
    // Create mini-plan for this tool call
    const plan: Plan = {
      id: generateId(),
      goal: `Execute ${controller.toolCallRequest.name}`,
      affectedFiles: [affectedFile],
      changes: [toolCallToChange(controller.toolCallRequest)],
      acceptanceCriteria: [],
      createdBy: "cli",
      createdAt: new Date().toISOString()
    };
    
    // Guardian review
    const decision = await guardian.reviewPlan(plan);
    
    if (decision.type === "approve") {
      controller.allow();
    } else {
      controller.deny(decision.reason);
    }
  } else {
    // Non-file tools (like GraphQuery) auto-approve
    controller.allow();
  }
}
```

### Step 7: Chronicle Integration

Create Chronicle system for agent memory:

```typescript
// packages/chronicle/ - Basic implementation
export interface Chronicle {
  append(path: string, event: ChronicleEvent): Promise<void>;
  read(path: string): Promise<ChronicleEvent[]>;
  query(path: string, filter: EventFilter): Promise<ChronicleEvent[]>;
}

export interface ChronicleEvent {
  type: string;
  timestamp: string;
  data: Record<string, any>;
}
```

### Step 8: Testing Strategy

1. **Agent Unit Tests**
   - Each agent with mock dependencies
   - Protocol implementations
   - State machine transitions

2. **Integration Tests**  
   - Agent communication patterns
   - CLI workflow with real agents
   - Chronicle persistence

3. **Protocol Tests**
   - Bullet Wound Invariant triggering
   - Reconciliation workflows
   - Transaction boundaries

## Files to Change

### New Files
- `packages/agents/` (entire package)
- `packages/chronicle/` (basic implementation)

### Modified Files
- `apps/cli/package.json` (add dependencies)
- `apps/cli/src/threads/utils/act.ts` (replace with agents)
- `apps/cli/src/threads/messaging/actions.ts` (agent integration)

## Risk Mitigation
- **High Risk**: Major architectural change from ad-hoc to formal
- **Medium Risk**: Agent communication complexity
- **Mitigation**: Gradual rollout, extensive testing, fallback mechanisms

## Dependencies
- `@sage/llm` for agent reasoning
- `@sage/tools` for agent actions  
- `@sage/graph` for code understanding
- `@sage/chronicle` for agent memory
- `@sage/ui` for agent interfaces

## Success Validation
1. All CLI functionality works with formal agents
2. Guardian properly protects files and detects contradictions
3. Sage creates reasonable plans from user intent
4. Delegator executes plans atomically
5. Agent memory persists across sessions
6. Performance is acceptable for agent operations

## Next Phase
With formal agents implemented, Phase 5 can add AQL integration for complex multi-agent workflows and declarative orchestration.