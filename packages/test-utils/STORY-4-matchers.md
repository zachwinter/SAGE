# Story 4: Protocol Matchers & Assertions

## Goal
Implement specialized matchers and assertions for SAGE's core protocols and invariants.

## Acceptance Criteria
From CONTRACT.md `@sage/test-utils` section:
- [ ] `toEqualDir(expectedStructure)` for deep directory comparison
- [ ] `toContainEvent(eventLike)` for Chronicle event matching
- [ ] `toBeCommitAddressable()` for Graph node validation
- [ ] `toRespectTransactionBoundary()` for staging/commit verification

## Implementation Plan

### Phase 1: Directory Structure Matcher
- Create `src/matchers/directory.ts` with deep comparison logic
- `toEqualDir(expectedStructure)` compares workspace to expected tree
- Recursive directory traversal with file content comparison
- Rich diff output showing added/removed/modified files
- Handle edge cases: symlinks, permissions, timestamps

### Phase 2: Chronicle Event Matcher  
- Create `src/matchers/chronicle.ts` with event pattern matching
- `toContainEvent(eventLike)` matches partial event objects
- Support for regex patterns in event content
- Event ordering and sequence matching
- Causal chain validation (prevEventId links)

### Phase 3: Graph Commit Addressability Matcher
- Create `src/matchers/graph.ts` with MVCC validation
- `toBeCommitAddressable()` validates nodes have required fields
- Check `first_seen`/`last_seen` commit indices
- Validate commit consistency across related entities
- Time-travel query verification

### Phase 4: Transaction Boundary Matcher
- Create `src/matchers/transaction.ts` for staging validation
- `toRespectTransactionBoundary()` verifies atomic operations
- Check that no changes escape staging before validation
- Verify rollback behavior on validation failure
- Track filesystem mutations during execution

### Phase 5: Protocol-Specific Matchers
- `toHaltOnContradiction()` for Bullet Wound Invariant testing
- `toStampUnsafe()` for Unsafe Protocol verification
- `toReconcileChanges()` for Reconciliation flow validation
- `toMaintainCausalChain()` for Chronicle integrity

### Phase 6: Test Framework Integration
- Export matchers for Vitest/Jest integration
- TypeScript integration with proper type inference
- Setup utilities for registering custom matchers
- Documentation and examples for each matcher

## Dependencies
- Test framework integration (Vitest/Jest)
- Stories 1-3 for workspace, adapters, and scenarios
- Deep object comparison utilities
- File system watching and diff utilities

## Estimated Effort
**4-5 hours** - Custom matchers with rich output formatting.

## Success Metrics
- Matchers provide clear, actionable failure messages
- Deep comparison works correctly for complex nested structures
- Performance acceptable for large directories and event logs
- TypeScript integration provides proper type safety
- Easy to extend with new protocol-specific matchers
- Rich diff output helps debug test failures quickly