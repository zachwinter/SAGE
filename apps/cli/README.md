# SAGE CLI

**"The Bridge to the Society."**

This application is the primary human-machine interface for the SAGE Framework. It is a powerful, interactive command-line tool that serves as the entry point for all developer-initiated conversations, commands, and workflows. It is the bridge through which a developer speaks to the collective consciousness of their codebase.

### Current Role

In its current form, this application is a comprehensive monolith containing the logic for UI, state management, LLM interaction, and agent-like behaviors. It is the proof-of-concept for the entire SAGE experience, orchestrating everything from the `sage ask` chat interface to the `sage ingest` analysis command.

### The Refactor Plan: A Great Extraction

The destiny of this application is to become a lean, powerful orchestrator. Its intelligence and capabilities will not be diminished; instead, they will be extracted into dedicated, reusable packages within the monorepo. This "great extraction" will make the system more modular, testable, and scalable.

- **UI Components & Rendering Logic** will move to `@sage/ui`.
- **Agent Tools (`Bash`, `GraphQuery`, etc.)** will move to `@sage/tools`.
- **The core logic for all SAGE agents** will be formalized in `@sage/agents`.
- **LLM interaction and prompt management** will move to `@sage/llm`.
- **Reading/writing to Chronicle files** will be handled by `@sage/chronicle`.

### Future Role: The Orchestrator

> **AQL integration (planned):** the CLI will expose `sage aql run <file.aql>` to
> compile and execute AQL queries against the active provider (` @sage/llm`) with
> streaming output and tool-call confirmation.

After the refactor, the `cli` will have one clear purpose: to orchestrate the collaboration between the user and the SAGE agents.

When a user runs `sage ask`, this application will:

1.  Instantiate the `Sage` agent from `@sage/agents`.
2.  Provide it with capabilities from `@sage/tools`.
3.  Power its reasoning with `@sage/llm`.
4.  Render the entire interaction using components from `@sage/ui`.

It will manage the high-level workflows and protocols—like Plan/Approve/Delegate and Reconciliation—but the deep logic for _how_ those protocols work will live in the dedicated packages. Its complexity will decrease as the power of the ecosystem increases.
