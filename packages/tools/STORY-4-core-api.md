# Story 4: Document Core API

## Description

As a developer integrating tools into my agent implementations, I want clear documentation of the main classes and methods so that I can effectively use the package in my code.

## Acceptance Criteria

- [ ] Core API section documents main tools (Read, Write, Edit, Bash) and ToolRegistry
- [ ] Key interfaces (`Tool`, `ToolContext`, `ToolResult`) are explained
- [ ] Safety wrappers and validation features are documented
- [ ] Tool schemas and registration patterns are covered

## Implementation Notes

- Extract API information from the existing README
- Show real method signatures and usage patterns for each tool
- Document the ToolRegistry and how to register custom tools
- Explain safety features like validation and sandboxing