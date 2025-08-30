# Story 4: Document Core API

## Description

As a developer integrating Chronicle into my project, I want clear documentation of the main functions and types so that I can effectively use the package in my code.

## Acceptance Criteria

- [ ] Core API section documents main functions (`appendEvent`, `readChronicle`, `tailChronicle`)
- [ ] Key types (`ChronicleEvent`, `ChroniclePath`) are explained
- [ ] Event model and canonicalization are referenced
- [ ] Concurrency and durability features are documented

## Implementation Notes

- Extract API information from the existing README
- Show real function signatures and usage patterns
- Explain eventId computation and causal linking