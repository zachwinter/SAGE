# Story 5: Map Ecosystem Relationships

## Description

As a developer understanding the SAGE architecture, I want to see how UI relates to other packages so that I can understand its role in the larger system.

## Acceptance Criteria

- [ ] Dependencies section lists and explains peer dependencies (Ink, React)
- [ ] Dependents section shows how `apps/cli` and future web apps use UI
- [ ] Relationships are described in terms of data flow and responsibilities
- [ ] Connection to LLM streaming and tool visualization is clear

## Implementation Notes

- Be specific about how apps/cli uses UI today
- Explain how the package works with `@sage/llm` for streaming events
- Connect to broader SAGE principles like consistent user experience
- Clarify the role of UI as the "voice" of the system