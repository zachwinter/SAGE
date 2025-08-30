# Story 4: Document Core API

## Description

As a developer integrating LLM into my project, I want clear documentation of the main classes and methods so that I can effectively use the package in my code.

## Acceptance Criteria

- [ ] Core API section documents main functions (`createChatStream`, `setProvider`, `listModels`)
- [ ] Key interfaces (`LLMProvider`, `ChatOptions`, `StreamEvent`) are explained
- [ ] Provider abstraction and MCP integration are documented
- [ ] Streaming and advanced features are covered

## Implementation Notes

- Extract API information from the existing README
- Show real method signatures and usage patterns
- Explain the provider interface and how to implement custom providers
- Document streaming capabilities and backpressure handling