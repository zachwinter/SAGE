# Story 2: In-Memory Adapters (Graph, Chronicle, LLM, Tools)

## Goal
Implement deterministic, in-memory adapters for all major SAGE interfaces to enable fast, isolated testing.

## Acceptance Criteria
From CONTRACT.md `@sage/test-utils` section:
- [ ] `makeGraphAdapter()` with MVCC-lite and minimal Cypher surface
- [ ] `makeChronicle()` with append-only and idempotent eventId handling
- [ ] `makeLLM()` with deterministic token streams and seeded randomness
- [ ] `makeTools()` with Read/Write/Edit/Bash fakes and quotas/timeouts

## Implementation Plan

### Phase 1: Graph Adapter (MVCC-lite)
- Create `src/adapters/graph.ts` with in-memory graph storage
- Implement commit tracking with `first_seen`/`last_seen` indices
- Basic Cypher query resolver for common patterns
- Support for MATCH, WHERE, RETURN with simple node/edge patterns
- Commit-aware query filtering

### Phase 2: Chronicle Adapter (Append-Only)
- Create `src/adapters/chronicle.ts` with in-memory event storage
- Implement `append()` and `read()` with proper event validation
- Event ID computation using canonical JSON hashing
- Idempotent append handling (skip duplicates)
- Time-ordered reads and tailing helpers

### Phase 3: LLM Adapter (Deterministic)
- Create `src/adapters/llm.ts` with seeded token generation
- Implement `chat()` method returning deterministic streams
- Tool call emission based on configured tool schemas
- Configurable response patterns and tool behaviors
- Usage tracking and streaming event synthesis

### Phase 4: Tools Adapter (Sandboxed Fakes)
- Create `src/adapters/tools.ts` with tool registry implementation
- Fake implementations of Read, Write, Edit, Bash tools
- Configurable quotas, timeouts, and permission policies
- Dry-run mode support for mutation preview
- Execution tracking and result validation

### Phase 5: Adapter Integration Helpers
- Factory functions with sensible defaults
- Easy configuration for common test scenarios
- Adapter composition for full SAGE stack simulation
- Error injection capabilities for failure testing

### Phase 6: Cross-Adapter Validation
- Ensure adapters follow their respective interface contracts
- Integration tests validating adapter behavior
- Performance benchmarks for large-scale operations
- Memory leak detection and cleanup validation

## Dependencies
- `@sage/utils` for canonicalization, hashing, and deterministic operations
- Interface definitions from respective packages
- Seeded random number generation for deterministic behavior

## Estimated Effort
**6-8 hours** - Multiple adapters with different complexity levels.

## Success Metrics
- All adapters implement their respective interfaces correctly
- Deterministic behavior across multiple test runs
- Performance suitable for test suites (hundreds of operations/second)
- Memory usage remains bounded during long test runs
- Easy to configure for different test scenarios
- Error conditions can be reliably simulated