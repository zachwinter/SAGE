# @sage/agents

> "The Society of Minds."

## Overview

This package implements the core logic for SAGE's archetypal agents — **Sage, Guardian, Warden, Delegator, Archivist**. These agents are specialized consciousnesses that embody SAGE's constitutional principles and protocols, negotiating Plans with evidence from the **Code Graph** and **Chronicles**.

### Relationship with SAGE Valve

Agents are activated by the **[SAGE Valve](../../apps/valve/README.md)**, which detects relevant changes in the codebase and triggers agents through Persona configurations.

## Installation

```bash
pnpm add @sage/agents
```

## Quick Start

```typescript
import { Guardian } from "@sage/agents";

// Create a Guardian agent for a specific file
const guardian = new Guardian({
  filePath: "/src/UserService.ts",
  graph: graphClient,     // @sage/graph for code understanding
  chronicle: chronicleClient, // @sage/chronicle for memory
  tools: toolRegistry,    // @sage/tools for safe operations
  llm: llmClient         // @sage/llm for reasoning
});

// Review a proposed change plan
const decision = await guardian.reviewPlan(plan);
if (decision.type === "deny") {
  console.log(`Change denied: ${decision.reason}`);
} else {
  console.log(`Change approved: ${decision.justification}`);
}
```

## Core API

### Guardian

Reviews proposed changes to its file and enforces architectural principles.

```typescript
interface IGuardian {
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  reconcile(edit: RogueEdit): Promise<ReconciliationOutcome>;
  selfInquiry(): Promise<SelfInquiryReport>;
  bulletWoundCheck(assertions: Assertion[]): Promise<void>; // may HALT_AND_REPORT
}
```

### Delegator

Executes approved Plans atomically within a transaction boundary.

```typescript
interface IDelegator {
  execute(plan: Plan): Promise<ExecutionReport>;
}
```

### Warden

Reviews infrastructure changes and manages environment policies.

```typescript
interface IWarden {
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  promote(build: BuildRef, from: Env, to: Env): Promise<PromotionResult>;
  postMortem(incident: Incident): Promise<PostMortemReport>;
}
```

### Sage

Ideates solutions and mediates between conflicting agent reviews.

```typescript
interface ISage {
  ideate(input: Intent): Promise<Ideation>;
  draftPlan(ideation: Ideation): Promise<Plan>;
  mediate(reviews: ReviewSet): Promise<MediationResult>;
}
```

### Archivist

Records and queries the historical lineage of files and directories.

```typescript
interface IArchivist {
  record(event: LineageEvent): Promise<void>;
  query(q: HistoryQuery): Promise<HistoryAnswer>;
}
```

## Key Protocols

### Bullet Wound Invariant
When a Guardian detects contradiction between its Chronicle and the Code Graph, it invokes `HALT_AND_REPORT`, freezing execution until reconciliation.

### Transaction Boundary
The Delegator ensures Plans execute atomically - no changes are committed unless all validators succeed.

### Reconciliation
When rogue edits occur, Guardians engage developers to justify changes and formally record outcomes.

### Unsafe Protocol
Denied Plans can be executed with explicit user override, permanently stamping artifacts with `PLAN_UNSAFE`.

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/graph](../graph/README.md)** — Agents query the Code Graph to understand code structure and relationships (Gnosis principle)
- **[@sage/chronicle](../chronicle/README.md)** — Agents log decisions and read history from Chronicle files (Remembering principle)
- **[@sage/llm](../llm/README.md)** — Agents use LLMs for natural language reasoning and planning
- **[@sage/tools](../tools/README.md)** — Agents execute safe operations on code through the tools registry

### Dependents  
- **[@sage/aql](../aql/README.md)** — The Delegator translates Plans into AQL queries for execution
- **[CLI applications](../../apps/cli/README.md)** — Applications instantiate and coordinate agents for user interactions

## Development Status

![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

This package provides the foundational interfaces and some core implementations for SAGE agents. Core agent logic is being actively developed, with implementations for each archetype in progress. The API is stabilizing but may still change as we refine the agent behaviors and interactions.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Run type checking
pnpm typecheck
```

## Contract

This package implements the **[Agents Contract](./CONTRACT.md)**, which defines:
- Deterministic protocol enforcement with explicit side-effect boundaries
- Auditability through structured justifications and Chronicle hooks
- Composability with narrow interfaces for testable units
- Stateless core with adapter-based I/O

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*