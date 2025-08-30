# @sage/agents - Implementation Context

## Package Purpose
Core logic, state machines, and protocols for SAGE's archetypal agents translating Principles & Protocols into executable behavior.

## Contract Requirements (from CONTRACT.md)

### Core Agent Interfaces
```ts
export interface IGuardian {
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  reconcile(edit: { filePath: string; diffRef: string }): Promise<{ ok: boolean }>;
  selfInquiry(): Promise<{ findings: string[] }>;
  bulletWoundCheck(assertions: { cypher: string; expectRows: boolean }[]): Promise<void>; // may throw HALT
}

export interface IDelegator { 
  execute(plan: Plan): Promise<{ ok: boolean; report: any }> 
}

export interface IWarden { 
  reviewPlan(plan: Plan): Promise<Approve|Deny> 
}

export interface ISage {
  ideate(input: { goal: string }): Promise<{ options: string[] }>;
  draftPlan(ideation: { options: string[] }): Promise<Plan>;
  mediate(reviews: { guardian: (Approve|Deny)[]; warden?: (Approve|Deny)[] }): Promise<{ decision: Approve|Deny }>;
}

export type Approve = { type: "approve"; justification: string };
export type Deny = { type: "deny"; reason: string };
```

## Key Protocols to Implement

### Bullet Wound Invariant
- `bulletWoundCheck()` must throw `HALT_AND_REPORT` when Code Graph contradicts Chronicle
- System-critical protocol that halts execution on contradictions

### Transaction Boundary  
- Delegator compiles Plans to AQL and executes atomically
- No changes committed unless all validators pass
- Staging area → validation → atomic commit

### Reconciliation Protocol
- Guardian `reconcile()` handles rogue edits
- Appends `RECONCILIATION` event to Chronicle with `diffRef` + justification
- User dialogue to justify external changes

### Unsafe Protocol
- Allows execution of denied Plans with explicit user override
- Must stamp all artifacts with `PLAN_UNSAFE` permanently
- Cross-links for audit trail

## State Machines

### Guardian Lifecycle
```
CLEAN ─evidence/contradiction→ WARNED ─resolved→ CLEAN
  │                              │
  └─rogue edit─→ RECONCILING ──reconcile──┘
                     │
                 dialogue
                     │
                     ▼
               HALT_AND_REPORT ←─fatal─ FAILED
```

### Delegator Execution
```
COMPILING → EXECUTING_AQL → COMMITTING → DONE
     │           │              │          │
     └───────────┴──────────────┴─────→ ABORTED
```

## Adapter Requirements
```ts
type GraphAdapter = {
  query<T>(cypher: string, params?: Record<string, unknown>): Promise<T>;
};

type ChronicleAdapter = {
  read(path: string): Promise<ChronicleEntry[]>;
  append(path: string, event: ChronicleEvent): Promise<void>;
};

interface AgentsDeps {
  graph: GraphAdapter;
  chronicle: ChronicleAdapter;
  tools: ToolRegistry;
  llm: LLMClient;
}
```

## Plan-to-AQL Compilation
- Delegator must compile approved Plans into AQL queries
- Integration with @sage/aql package for execution
- Plans contain high-level intent; AQL contains execution steps

## Chronicle Integration
All agent decisions must log to Chronicles:
- `PLAN_DRAFTED`, `PLAN_APPROVED`, `PLAN_DENIED`
- `RECONCILIATION`, `HALT_AND_REPORT`
- `PLAN_UNSAFE` with cross-references

## Dependencies
- `@sage/graph` for GraphAdapter interface
- `@sage/chronicle` for ChronicleAdapter interface  
- `@sage/llm` for LLMClient interface
- `@sage/tools` for ToolRegistry interface
- `@sage/aql` for Plan compilation and execution
- `@sage/utils` for error handling