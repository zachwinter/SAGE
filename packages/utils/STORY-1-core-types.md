# Story 1: Core Types & Time Abstractions

## Goal

Implement the foundational types and interfaces that all SAGE packages depend on.

## Acceptance Criteria

From CONTRACT.md `@sage/utils` section:

- [ ] `ISO8601` type for timestamp strings
- [ ] `Clock` interface with `now(): ISO8601` method
- [ ] `Random` interface with `int()` and `float()` methods
- [ ] All types exported from main module

## Implementation Plan

### Phase 1: Basic Types

- Create `src/types.ts` with core type definitions
- Export `ISO8601` as branded string type
- Define `Clock` and `Random` interfaces

### Phase 2: Clock Implementations

- Create `src/clock.ts` with production and test implementations
- `SystemClock` using `new Date().toISOString()`
- `FixedClock` for deterministic testing

### Phase 3: Random Implementations

- Create `src/random.ts` with seeded and system implementations
- `SystemRandom` using `Math.random()`
- `SeededRandom` for deterministic testing

### Phase 4: Module Exports

- Update `src/index.ts` to export all types and default implementations
- Ensure tree-shaking friendly exports

## Dependencies

None - this is the foundation package.

## Estimated Effort

**1-2 hours** - Straightforward type definitions and simple implementations.

## Success Metrics

- All types compile without errors
- Default implementations work in both Node and browser contexts
- Test utilities can inject fixed clock/random for determinism
