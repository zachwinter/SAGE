# Story 3: Agent Scenario DSL & Harnesses

## Goal
Implement a fluent DSL for setting up complete agent scenarios with Plan/Approve/Delegate flows.

## Acceptance Criteria
From CONTRACT.md `@sage/test-utils` section:
- [ ] Fluent scenario builder DSL for agent setup
- [ ] Complete Plan/Approve/Delegate workflow simulation
- [ ] Agent harness helpers with expectation APIs
- [ ] Chronicle and Graph expectation utilities

## Implementation Plan

### Phase 1: Scenario Builder Core
- Create `src/scenarios.ts` with fluent scenario API
- `scenario().withWorkspace().withGraph().withChronicle()` builder pattern
- Method chaining for clean test setup
- Internal state management for complex scenarios

### Phase 2: Agent Harness Integration
- `.withGuardian(filePath)` creates Guardian with proper dependencies
- `.withDelegator()` creates Delegator with tool/llm access
- `.withSage()` creates Sage with ideation/planning capabilities
- Automatic dependency injection and wiring

### Phase 3: Workflow Orchestration Helpers
- `sageDraftPlan({ goal })` helper for plan creation
- `guardian(path).reviewPlan(plan)` for approval workflows
- `delegator.execute(plan)` for execution simulation
- Cross-agent communication and state management

### Phase 4: Expectation APIs
- `expectChronicle(path).toContainEvent(match)` for event assertions
- `expectGraph(query, params).toReturn(rows)` for graph state verification
- Fluent expectation chaining and composition
- Rich diff output for failed expectations

### Phase 5: Protocol Testing Helpers
- Transaction Boundary testing: staging → validation → commit
- Bullet Wound scenario setup: contradiction detection
- Reconciliation flow: rogue edit → dialogue → chronicle
- Unsafe Protocol: denied plan → override → stamping

### Phase 6: Complex Scenario Composition
- Multi-agent negotiation scenarios
- Committee formation and mediation workflows
- Long-running workflows with multiple approvals
- Error recovery and rollback scenarios

## Dependencies
- `@sage/agents` for agent interfaces and implementations
- Stories 1-2 for workspace and adapter infrastructure
- `@sage/utils` for deterministic time/random utilities

## Estimated Effort
**5-6 hours** - Complex orchestration with many moving parts.

## Success Metrics
- Can set up complete agent societies in a few lines of code
- Protocol testing scenarios are easy to express and verify
- Rich failure output helps debug complex agent interactions
- Performance suitable for integration test suites
- Scenarios are deterministic and repeatable
- Easy to extend for new agent types and protocols