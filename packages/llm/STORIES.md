# Stories for @sage/llm Implementation

## Current Status *(Updated after comprehensive audit)*
- Story 1 (Core API & Provider Interface): ✅ Complete
- Story 2 (Streaming & Event System): ✅ Complete  
- Story 3 (Tool Integration & Validation): ✅ Complete
- Story 4 (Provider Adapters): ⚠️ Infrastructure Complete, Need Real Implementations
- Story 5 (Caching & Performance): ✅ Complete
- Story 6 (Error Handling & Safety): ⚠️ Mostly Complete (Core done via BaseAdapter)
- Story 7 (Telemetry & Observability): ⚠️ Partial (Core metrics done, need logging hooks)
- Story 8 (Configuration & Environment Management): ⚠️ Partial (Provider config done, need env integration)

## 🎯 Critical Path: NEW STORIES FOR COMPLETION
- **Story 9: Provider Adapter Completion** (12-16 hours) - OpenAI, Anthropic, LM Studio implementations
- **Story 10: Production Readiness & Polish** (8-12 hours) - Environment config, telemetry hooks, security audit
- **Story 11: @sage/mcp Integration & Modernization** (4-6 hours) - Integrate MCP as a first-class provider

## Missing Stories Based on Requirements

### Story 2: Streaming & Event System
**Goal**: Implement full streaming support with backpressure handling and proper event emission
**Requirements**:
- Full AsyncIterable support with proper backpressure
- Event normalization across providers
- Round start/end events for multi-turn conversations
- Proper error propagation in streams
**Dependencies**: Story 1

### Story 3: Tool Integration & Validation
**Goal**: Implement JSON Schema validation for tools and secure tool execution
**Requirements**:
- JSON Schema validation for tool arguments
- Tool call approval/denial system
- CallId pairing across tool_call ↔ tool_result events
- Malformed argument handling (validation error, not execution)
**Dependencies**: Story 1

### Story 4: Provider Adapters
**Goal**: Implement adapters for major LLM providers
**Requirements**:
- OpenAI adapter with streaming and tool calling
- Anthropic adapter with streaming and tool calling
- LM Studio adapter (act-loop bridge)
- Test/Fake provider for deterministic testing
**Dependencies**: Stories 1-3

### Story 5: Caching & Performance
**Goal**: Implement prompt-level caching with multiple modes
**Requirements**:
- Canonical cache key generation (model, messages, tools, temperature, max_tokens)
- Cache modes: read-through, record-only, bypass
- Full-turn caching (not token-level)
- Optional prompt hashing for privacy
**Dependencies**: Story 1

### Story 6: Advanced Error Handling & Safety
**Goal**: Implement robust error handling and safety features
**Requirements**:
- Configurable timeouts with defaults
- Exponential backoff retry with jitter
- Provider-specific error normalization
- Rate limiting and token budget guards
- Secret redaction in telemetry
**Dependencies**: Story 1

### Story 7: Telemetry & Observability
**Goal**: Add comprehensive observability features
**Requirements**:
- Request/response logging hooks
- Duration and token usage metrics
- Cache hit/miss tracking
- Traceability with requestId
**Dependencies**: Stories 1, 5, 6

### Story 8: Configuration & Environment Management
**Goal**: Implement configuration system and environment handling
**Requirements**:
- Provider configuration management
- Environment variable integration
- Model allowlists per provider
- Tool capability restrictions
**Dependencies**: Story 1

## 🚀 UPDATED Priority Order
1. **Story 9: Provider Adapter Completion** ⚡ **CRITICAL** - Unblocks production usage
2. **Story 10: Production Readiness & Polish** - Environment config, security, docs
3. **Story 11: @sage/mcp Integration** - Leverage enterprise-grade MCP protocol support
4. Story 6: Error Handling (remaining features) - Rate limiting, secret redaction
5. Story 7: Telemetry (remaining features) - Logging hooks, structured events
6. Story 8: Configuration (remaining features) - Environment integration

## Implementation Approach
Each story should follow the pattern established in STORY-1-core-api.md:
- Clear goal statement
- Detailed acceptance criteria from contract
- Phased implementation plan
- Dependencies listed
- Estimated effort
- Success metrics