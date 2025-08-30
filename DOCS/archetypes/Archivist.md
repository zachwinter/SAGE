# The Archivist

_“The Memory of the Land.”_

## Core Function

The Archivist is the repository’s official historiographer. While [Guardians](../archetypes/Guardian.md) remember the life of individual files, the Archivist remembers the life of the terrain itself—the structure of directories and files over time. It maintains an authoritative account of lineage and location so any past state can be reconstructed and queried.

## Scope

**Project‑Level.** Exactly one Archivist per SAGE‑enabled repository.

## Key Responsibilities

- **Log file lifecycle.** Notice and record `FILE_ADDED`, `FILE_REMOVED`, `FILE_RENAMED`, `FILE_SPLIT`, and `FILE_MERGED` events.
- **Maintain lineage in the [Code Graph](../core-concepts/Lexicon.md#code-graph).** Create/maintain ancestry edges such as `(:File)-[:WAS_RENAMED_TO]->(:File)` and merge/split relations, all **commit‑addressed**.
- **Time‑travel queries.** Ensure every node/edge is versioned with a commit index so historical questions are answerable in context (see [Commit‑Addressable Graph](../core-concepts/Lexicon.md#commit-addressable-graph)).
- **Record system‑wide integrity events.** Persist events like `DAEMON_OUTAGE_WINDOW`, `INCONSISTENCY_DETECTED`, and `PLAN_UNSAFE` with links to their causes (e.g., originating [Plan](../core-concepts/Lexicon.md#plan), [Guardian](../archetypes/Guardian.md), or [Warden](../archetypes/Warden.md)).
- **Serve as oracle of history.** Answer queries such as: “What file occupied this namespace at commit `abc123`?” or “Show the ancestors of `AuthService.ts`.”
- **Support the [Genesis Thread](../core-concepts/Lexicon.md#genesis-thread).** Provide architectural context snapshots that other agents inherit at onboarding.

## Guarantees

- **Continuity of lineage.** Renames, moves, splits, and merges are never lossy; ancestry is explicit.
- **Commit‑addressable history.** All structural facts are tied to concrete commits; past states are reconstructible.
- **Causal traceability.** Historical events link to their precipitating Plans/agents, enabling end‑to‑end explanations.

## Protocols & Events

- **Notice** (Principle of Noticing): The [Daemon](../core-concepts/Lexicon.md#daemon) streams filesystem/git events; the Archivist normalizes and records them.
- **Integrity bookkeeping** (Principle of Integrity): When `INCONSISTENCY_DETECTED` is raised (e.g., by a Guardian’s Bullet Wound response), the Archivist records the window, links artifacts (plans, diffs, CI runs), and marks affected lineage entries.
- **Unsafe execution:** On `PLAN_UNSAFE`, record a permanent constitutional breach entry and link the impacted files/Guardians.
- **Reconciliation hooks:** When a [Rogue Edit](../core-concepts/Lexicon.md#rogue-edit) is reconciled, append the justification reference and resulting diff pointer.

## Primary Data Sources

- Git commit history.
- Filesystem events from the [Daemon](../core-concepts/Lexicon.md#daemon).
- Direct reports from agents (e.g., `PLAN_UNSAFE` from [Sage](../archetypes/Sage.md), integrity alerts from [Guardians](../archetypes/Guardian.md) and [Wardens](../archetypes/Warden.md)).
- The current [Code Graph](../core-concepts/Lexicon.md#code-graph) for validation and back‑filling lineage.

## Primary Artifacts

- **Archivist’s Chronicle:** `.sage/archivist.sage` — immutable ledger of structural history and integrity events.
- **Graph lineage edges:** Commit‑addressed relations (rename/merge/split) maintained in the Code Graph.

## Key Interactions

- **Consulted by Sage:** Supplies long‑term structural context for ideation and impact analysis.
- **Consulted by Wardens:** Maps builds/deployments to the exact Guardians/files that existed at a point in time.
- **Consulted by Guardians:** Answers origin/lineage queries during self‑inquiry and Reconciliation.
- **Feeds the Daemon:** Provides backfill and correction windows after outages.

## Example Queries

> _Illustrative Cypher‑style patterns; adapt to your Kùzu schema._

**Ancestors of a file:**

```cypher
MATCH (f:File {path: $path})-[:WAS_RENAMED_FROM|:WAS_SPLIT_FROM*]->(a:File)
RETURN a ORDER BY a.created_at ASC;
```

**File at a commit:**

```cypher
MATCH (f:File)-[r:EXISTS_AT]->(c:Commit {id: $commit})
RETURN f;
```

**Rename chain between two commits:**

```cypher
MATCH (c1:Commit {id: $from}),(c2:Commit {id: $to})
MATCH p = (f:File)-[:WAS_RENAMED_TO*]->(g:File)
WHERE f.first_seen <= c2.index AND g.last_seen >= c1.index
RETURN p;
```

## In a Nutshell

**The Archivist ensures that the project’s structural lineage is never lost, past states are reconstructible, and historical questions are answerable with evidence.**

## See also

- [Principle of Noticing](../core-concepts/Principles.md#1-principle-of-noticing)
- [Principle of Integrity](../core-concepts/Principles.md#4-principle-of-integrity)
- [Reconciliation](../core-concepts/Principles.md#reconciliation)
