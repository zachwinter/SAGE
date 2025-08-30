# The Sage

_“The Mind of the System.”_

## Core Function

Sage is the system’s primary creative, strategic, and architectural partner. It is the main conversational interface for the developer, turning intent into formalized [Plans](../core-concepts/Lexicon.md#plan). Where Guardians defend and Delegators execute, Sage imagines, analyzes, and synthesizes.

## Scope

**Session-Level.** Sage lives for the duration of an ideation session, producing Plans and reflective artifacts.

## Key Responsibilities

- **Facilitate ideation.** Engage in open-ended dialogue with the developer to clarify goals and surface possible solutions.
- **Perform architectural analysis.** Query the [Code Graph](../core-concepts/Lexicon.md#code-graph), [Archivist](../archetypes/Archivist.md), and agent Chronicles to contextualize change impacts.
- **Draft formal Plans.** Translate discussion into a strongly-typed Plan object specifying goals, affected agents, changes, and acceptance criteria.
- **Mediate negotiations.** When Guardians or Wardens raise conflicts, act as facilitator to seek consensus.
- **Engage in reflective journaling.** After sessions, update its internal graphs (`user.graph`, `sage.graph`) for personalization and adaptive learning.

## Guarantees

- **Clarity.** Developer intent is crystallized into precise, verifiable Plans.
- **Contextuality.** All proposals are grounded in ecosystem-wide architectural analysis.
- **Continuity.** Reflective updates ensure that learning persists across sessions.

## Protocols & Events

- **Ideation Protocol.** Developer ↔ Sage freeform dialogue leading to structured outcomes.
- **Plan Drafting.** Always yields a typed Plan artifact.
- **Negotiation Mediation.** Actively arbitrates Plan approval disagreements.
- **Reflective Update.** Journaling step updating personalization and architectural graphs.

## Primary Data Sources

- Direct developer input.
- [Code Graph](../core-concepts/Lexicon.md#code-graph).
- Chronicles of Guardians, Wardens, Librarian, Archivist.
- Its own `user.graph` and `sage.graph`.

## Primary Artifacts

- **Plan:** Formal proposal for change.
- **Reflective Graphs:** `sage.graph` (self-improvement) and `user.graph` (developer personalization).

## Key Interactions

- **Partners with Developer.** The primary thought partner in creative/strategic design.
- **Proposes Plans for review.** Submits proposals to developer, Guardians, Wardens.
- **Hands off execution.** Once approved, passes Plan to [Delegator](../archetypes/Delegator.md).

## Example Flow

1. Developer expresses intent.
2. Sage explores implications via Code Graph and Chronicles.
3. Drafts Plan.
4. Mediates review among Guardians/Wardens.
5. Hands off to Delegator.
6. Updates reflective graphs.

## In a Nutshell

**Sage ensures that developer intent becomes precise, contextualized, and actionable, transforming raw ideas into Plans that the ecology can debate and execute.**
