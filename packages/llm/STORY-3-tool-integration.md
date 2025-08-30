# Story 3: Tool Integration & Validation

## Goal

Implement robust JSON Schema validation for tools and secure tool execution with proper callId pairing.

## Acceptance Criteria

From CLAUDE.md requirements:

- [x] Tools described with JSON Schema for LLM consumption
- [x] Arguments validated before execution using JSON Schema
- [x] `callId` pairing across `tool_call` ↔ `tool_result` events
- [x] Malformed tool args result in validation error (do NOT execute)
- [x] Tool call approval/denial system with policy hooks
- [x] Secure execution boundaries for tools

## Implementation Plan

### Phase 1: JSON Schema Validation Infrastructure ✅ COMPLETED

- [x] Integrate JSON Schema validation library (ajv or similar)
- [x] Create validation utilities for tool arguments
- [x] Implement schema validation error handling
- [x] Add validation result types

**Implementation Notes:** Complete JSON Schema validation implemented in `src/tool-validation.ts` using AJV with proper error handling.

### Phase 2: Tool Call Management ✅ COMPLETED

- [x] Enhance `StreamEvent` types with tool validation states
- [x] Implement callId generation and tracking
- [x] Create tool call lifecycle management
- [x] Add tool call result pairing mechanism

**Implementation Notes:** Full tool call lifecycle management in `src/tool-lifecycle.ts` with callId tracking and result pairing.

### Phase 3: Security & Approval System ✅ COMPLETED

- [x] Implement tool call approval/denial hooks
- [x] Create default security policies
- [x] Add safe tool allowlists
- [x] Implement guard policy framework

**Implementation Notes:** Comprehensive security system in `src/security-policies.ts` with configurable allow/deny lists and custom policy hooks.

### Phase 4: Integration with Streaming ✅ COMPLETED

- [x] Connect tool validation to streaming event system
- [x] Handle tool call events in streams
- [x] Implement tool result feeding back to providers
- [x] Add validation error events to streams

**Implementation Notes:** Full integration in `src/api.ts` with `enhanceStreamWithRounds` handling tool validation and `tool_validation_error` events.

### Phase 5: Testing & Validation ✅ COMPLETED

- [x] Create comprehensive tests for tool validation
- [x] Test malformed argument handling
- [x] Validate callId pairing across events
- [x] Test approval/denial policies

**Implementation Notes:** Extensive test coverage in `__tests__/tool-integration.test.ts` covering all validation scenarios and policy enforcement.

## Dependencies

- Story 1: Core API & Provider Interface (completed)
- Story 2: Streaming & Event System (completed)

## Estimated Effort

**~~8-10 hours~~** - ✅ **COMPLETED** - Tool validation system fully implemented.

## Success Metrics ✅ ALL ACHIEVED

- [x] JSON Schema validation prevents malformed tool execution
- [x] callId pairing works correctly across tool_call/tool_result events
- [x] Security policies can approve/deny tool calls
- [x] Integration with streaming system is seamless
- [x] Ready for provider adapter implementation in Story 4

## Current Status: ✅ COMPLETED

This story is **fully implemented**. The tool integration system is comprehensive and production-ready, including:

- Complete JSON Schema validation with AJV integration
- Robust tool call lifecycle management with callId tracking
- Flexible security policy framework with allow/deny lists
- Seamless integration with the streaming system
- Comprehensive error handling and validation events
- Extensive test coverage

**Key Features Implemented:**
- `ToolValidator` class with schema validation
- `ToolCallManager` for lifecycle and result pairing  
- `SecurityPolicyManager` with configurable policies
- Integration in streaming pipeline with validation events
- Global tool registration and management system

**Next:** Story 9 (Provider Completion) is the critical path for production readiness.