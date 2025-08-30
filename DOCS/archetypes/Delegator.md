# The Delegator

_“The Will Made Manifest.”_

## Core Function

The Delegator is a **compiler and transaction manager**. Its role is to convert an approved [Plan](../Lexicon.md#plan) into [AQL (Agent Query Language)](../../packages/aql/README.md) and ensure its atomic execution under a [Transaction Boundary](../Lexicon.md#transaction-boundary).

**The Delegator does not design or orchestrate workflows; it enforces them.** Its hands are only translators: Plans are written in AQL, not TypeScript.

## Scope

**Transaction‑Level.** The Delegator exists only for the lifecycle of a single Plan execution. It is stateless between transactions.

## Key Responsibilities

- **Compile Plan to AQL:** Use a pure helper function (`@sage/agents/src/plan-to-aql.ts`) to deterministically convert a `Plan` object into a typed AQL query string.
- **Execute AQL:** Hand the compiled AQL to the `@sage/aql` engine for execution.
- **Enforce Transaction Boundary:** Wrap the entire execution in a staging filesystem and mock tool adapters. No changes are committed to the actual workspace unless the AQL execution succeeds completely.
- **Commit or Rollback:** If the AQL execution is successful, commit the changes from the staging area to the workspace. If it fails, discard the staging area, ensuring the workspace remains untouched.
- **Emit Telemetry:** Record the outcome of the execution in the [Chronicle](../Lexicon.md#chronicle).

## Guarantees

- **Atomicity.** A Plan either succeeds completely or fails completely, leaving no partial state behind.
- **Determinism.** A given Plan will always compile to the same AQL, making the translation step predictable and testable.
- **Safety.** All filesystem and tool interactions during execution are sandboxed within the transaction boundary.

## Protocols & Events

The Delegator emits a clean trace of its lifecycle:

1.  **`PLAN_COMPILED`:** Emitted after the Plan is successfully converted to AQL. Includes hashes of the plan and the resulting AQL for traceability.
2.  **`EXECUTION_REPORT`:** Emitted by the AQL engine, summarizing the outcome of the execution (success or failure).
3.  **`PLAN_COMMITTED` or `PLAN_ABORTED`:** Emitted after the transaction is either committed to the workspace or rolled back.

## Primary Data Sources

- A fully approved [Plan](../Lexicon.md#plan) object from Sage.

## Primary Artifacts

- **Chronicle Events:** `PLAN_COMPILED`, `EXECUTION_REPORT`, `PLAN_COMMITTED`/`PLAN_ABORTED`.
- The final filesystem changes, if the transaction is committed.

## Key Interactions

- **Receives Plans from Sage.**
- **Invokes the `@sage/agents/src/plan-to-aql.ts` compiler.**
- **Invokes the `@sage/aql` execution engine.**
- **Appends events to the [Chronicle](../Lexicon.md#chronicle).**

## Example Lifecycle

1.  **Input:** Receives an approved `Plan`.
2.  **Compile:** Uses `plan-to-aql.ts` to turn the `Plan` into a typed AQL query.
    - Emits `PLAN_COMPILED`.
3.  **Execute:** Hands the AQL off to `@sage/aql` for execution within a transaction boundary (staging FS, mock tools).
4.  **Report:** Receives an `ExecutionReport` from the AQL engine.
    - Emits `EXECUTION_REPORT`.
5.  **Commit/Abort:** Based on the report, either commits the changes from the staging area or aborts the transaction.
    - Emits `PLAN_COMMITTED` or `PLAN_ABORTED`.

## In a Nutshell

**The Delegator converts Plans into AQL and ensures atomic execution under a Transaction Boundary.**

## ExecutionReport schema (excerpt)

```ts
export interface ExecutionReport {
  planHash: string;
  startedAt: string;
  endedAt: string;
  ok: boolean;
  retries: number;
  validators: Array<{
    name: string;
    status: "pass" | "fail";
    durationMs: number;
    logsRef?: string; // path/blob hash
  }>;
  diffRef?: string; // path/blob hash to atomic diff applied
  notes?: string;
}
```

## See also

- [Transaction Boundary](../Principles.md#transaction-boundary)
- [Unsafe Protocol](../Principles.md#unsafe-protocol)
