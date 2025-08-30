# Story 5: Map Ecosystem Relationships

## Description

As a developer understanding the SAGE architecture, I want to see how MCP relates to other packages so that I can understand its role in the larger system.

## Acceptance Criteria

- [ ] Dependencies section explains why MCP has no dependencies (foundational protocol)
- [ ] Dependents section shows how `@sage/llm` and `@sage/tools` use MCP
- [ ] Relationships are described in terms of data flow and responsibilities
- [ ] Connection to LLM provider abstraction is clear

## Implementation Notes

- Be specific about how `@sage/llm` uses MCP for provider abstraction
- Explain how `@sage/tools` registers tools through MCP protocol
- Connect to broader SAGE principles like standardization and tool integration
- Clarify the complementary relationship between MCP and LLM packages