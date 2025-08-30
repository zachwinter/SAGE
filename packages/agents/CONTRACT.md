# Agents Contract

## Purpose

This package provides the core logic, state machines, and protocols for SAGE's archetypal agents — **Sage, Guardian, Warden, Delegator, Archivist**. It translates the constitutional **Principles & Protocols** into executable behavior.

## Interface

### Core Agent Interfaces

```typescript
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

export interface ILibrarian {
  search(query: string): Promise<{ results: SearchResult[] }>;
  index(filePath: string): Promise<void>;
  getContext(query: string): Promise<{ context: string; withinTokenLimit: boolean }>;
}

export interface IArchivist {
  record(event: LineageEvent): Promise<void>;
  query(q: HistoryQuery): Promise<HistoryAnswer>;
}

export type Approve = { type: "approve"; justification: string };
export type Deny = { type: "deny"; reason: string };
```

### Adapter Requirements

```typescript
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

## Guarantees

- **Deterministic Protocols** - Side-effect boundaries are explicit; all writes go through injected adapters
- **Auditability** - Every decision includes structured justification and Chronicle hooks
- **Composability** - Agents are small, testable units with narrow interfaces
- **Stateless Core** - Agents perform no direct I/O; all side effects handled by external adapters

## Error Handling

Agents may throw specific error types for different failure modes:
- `HALT_AND_REPORT` - Raised by Guardian when Code Graph contradicts Chronicle
- `ValidationError` - When input validation fails
- `ExecutionError` - When plan execution fails

## Performance

- Agents should respond to simple queries in under 100ms
- Complex operations (like self-inquiry) should complete in under 1 second
- All Chronicle and Graph operations should use efficient queries with proper indexing