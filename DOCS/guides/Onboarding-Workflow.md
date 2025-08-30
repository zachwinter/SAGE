# Onboarding: The Genesis of a Living Codebase

To onboard a project into the SAGE ecosystem, a user runs a single command:

```bash
sage ingest
```

This command initiates a process that transforms a static codebase into a living, queryable society.

## Phase 1: Creating the Ground Truth

First, the `ingest` process performs a static analysis of the entire project, converting its structure, entities, and relationships into a **Kuzu Code Graph**. This process is remarkably fast; for reference, it takes approximately one second to represent the entire SAGE monorepo in the graph.

This graph is the objective, verifiable reality of the code's structure.

## Phase 2: The Genesis Committee Protocol

With the graph created, the system must now understand the *intent* behind the structure. This is achieved through the **Genesis Committee Protocol**, which enforces the **[Principle of Territorial Gnosis](./Principles.md#1-principle-of-territorial-gnosis)**.

### 1. Topographical Survey

Before invoking any LLM, Sage performs a fast, quantitative analysis of the filesystem, looking for patterns of "bigness":

-   **Width:** Directories with a high number of direct children.
-   **Depth:** Directories with long chains of nested subdirectories.
-   **Density:** Directories with a high total file count in their subtree.
-   **Recency:** Directories with recent, frequent changes (from git metadata).

### 2. Chartering the Committee & Delegating

Based on the survey, Sage doesn't try to understand everything at once. It forms a committee by chartering specialized agents (**Committee Delegates**) for significant top-level directories (e.g., `src/`, `apps/`, `packages/`).

Each Delegate receives a mandate: *"You are the custodian of the territory `[directory_path]`. Your first duty is to understand its purpose and structure. Report on your findings."*

### 3. Committee Strategies

The committee uses two key strategies to manage complexity:

#### Strategy for "Wide" Folders (e.g., `src/components/`)

A wide folder with many peer files (e.g., 100 components) is not analyzed one-by-one. The Committee Delegate for that territory acts as a **Chairperson**, first clustering the files into conceptual units before delegating further.

-   **Conceptual Clustering:** Files like `Button.tsx`, `Button.stories.tsx`, and `Button.test.tsx` are grouped into a single "Button" unit, and a temporary delegate is chartered to understand that single concept.
-   **Topological Clustering:** The Chair analyzes imports to find tightly-coupled cliques of files, treating them as a single sub-system with their own delegate.
-   **Archetypal Clustering:** The Chair identifies patterns to form sub-committees for "Data Fetching Components," "UI Primitives," etc.

The Chairperson's final report to Sage is a structured summary of its sub-committees, not a flat list of 100 files.

#### Strategy for "Deep" Folders (e.g., `src/core/api/v1/...`)

A deep folder represents a hierarchy of context. The delegation mirrors the folder structure in a **Chain of Command**.

1.  Sage charters a Delegate for `src/core/`.
2.  The `core` Delegate charters a sub-delegate for `api/`, passing down its context: *"You are responsible for the `api` sub-system within the `core` territory..."*
3.  This continues down the chain, so the agent for `profile.ts` only needs to understand its role within the `users` handler, because the broader context is passed down from its superiors.

### 4. The Genesis Chronicle

The final, structured "committee report" from this process becomes the **Genesis Chronicle**. This is the foundational memory of the project, created by a society of agents, which gives all future agents their shared origin context.

## The Development Workflow: A Conversation with the Society

Once properly ingested, interacting with a SAGE project will feel instantly familiar to users of modern AI-assisted coding platforms.

The workflow is a structured conversation:

1.  **Ideation (Plan Mode):** The user interacts primarily with **Sage**. Armed with the ability to query the graph and access the Chronicle of any file, Sage engages the user in an ideation phase to understand their goal. The output of this phase is a formal, typed **Plan** artifact, which the user must explicitly approve.

2.  **Verification & Negotiation:** The Plan is then subject to an additional verification layer. Each **Guardian** whose file is affected by the Plan must explicitly approve it or provide a reason for denying it. This transforms the process into a negotiation between the user and the codebase itself, with each entity having a voice.

3.  **Execution:** Once all Guardians approve, the Plan is passed to the **Delegator**. The Delegator's sole job is to translate the Plan into an **AQL (Agent Query Language)** query, which is then executed by the system.

---

### Next Up: The Illusion of Latency

Now that you understand the depth of context and history that each agent possesses, discover how the SAGE framework makes interacting with them feel instantaneous.

**➡️ [Read Next: Instant Recall in a Living System](./Instant-Recall.md)**
