# Story 9: Provider Adapter Completion

## Goal

Complete the implementation of production provider adapters (OpenAI, Anthropic, LM Studio, and MCP) to make @sage/llm fully functional with a variety of local and remote LLM services.

## Acceptance Criteria

From CLAUDE.md requirements:

- [ ] **OpenAI adapter** with streaming, tool calling, and error handling
- [ ] **Anthropic adapter** with streaming, tool calling, and error handling  
- [ ] **LM Studio adapter** implementing the act-loop bridge from NOTES.md
- [ ] **MCP adapter** that integrates with `@sage/mcp`'s `MCPClientManager`.
- [ ] All adapters support the unified StreamEvent interface
- [ ] Provider-specific error normalization and retry logic
- [ ] Model discovery and availability checking
- [ ] Rate limiting and authentication handling
- [ ] Tool schema conversion for each provider's format

## Implementation Plan

### Phase 1: OpenAI Adapter Implementation

- Implement streaming chat completion with proper event mapping
- Add tool calling support using OpenAI's functions API
- Handle OpenAI-specific errors (rate limits, auth, model availability)
- Implement token usage tracking and reporting
- Add model listing and capability detection

### Phase 2: Anthropic Adapter Implementation

- Implement streaming with Anthropic's Messages API
- Add tool calling support using Anthropic's tools format
- Handle Anthropic-specific errors and rate limiting
- Implement proper message role mapping
- Add Claude model listing and feature detection

### Phase 3: LM Studio Adapter Integration

- Integrate the act-loop bridge specification from NOTES.md
- Implement proper tool call guarding and approval flow
- Handle round start/end events from LM Studio callbacks
- Add proper streaming with fragment assembly
- Implement chat session management and reuse

### Phase 4: MCP Adapter Implementation

- Implement an `MCPProvider` that wraps `@sage/mcp`'s `MCPClientManager`.
- Map the `@sage/llm` chat stream to the MCP protocol.
- Ensure tool calls are correctly handled through the MCP bridge.
- Add dependency on `@sage/mcp`.

### Phase 5: Provider Registration & Discovery

- Implement provider auto-registration system
- Add runtime provider switching capabilities
- Create provider capability introspection
- Add configuration validation per provider
- Implement provider health checks

### Phase 6: Integration & Testing

- Create comprehensive provider integration tests
- Test error scenarios and recovery for each provider
- Validate tool calling across all providers
- Test streaming performance and backpressure handling
- Add provider-specific configuration examples

## Dependencies

- Story 1: Core API & Provider Interface (completed)
- BaseAdapter class and error handling infrastructure (completed)
- Stream utilities and event normalization (completed)
- `@sage/mcp` for the `MCPClientManager`.

## Estimated Effort

**12-16 hours** - Significant work to implement three production providers with full feature parity.

## Success Metrics

- All four providers (OpenAI, Anthropic, LM Studio, MCP) are functional
- Can switch between providers at runtime using setProvider()
- Tool calling works identically across all providers
- Streaming events are normalized to the same interface
- Error handling is robust and provider-aware
- All existing tests pass with real provider implementations
- Ready for agent integration in @sage/agents

## Implementation Notes

### OpenAI Integration
```typescript
import OpenAI from 'openai';
import { BaseAdapter } from './base.js';
import type { ChatOptions, StreamEvent } from '../types.js';

export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;
  
  constructor(config: { apiKey: string; baseURL?: string }) {
    super('openai', config);
    this.client = new OpenAI(config);
  }
  
  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    // Implementation details...
  }
}
```

### Anthropic Integration
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BaseAdapter } from './base.js';

export class AnthropicAdapter extends BaseAdapter {
  private client: Anthropic;
  
  constructor(config: { apiKey: string }) {
    super('anthropic', config);
    this.client = new Anthropic(config);
  }
}
```

### LM Studio Integration
Use the detailed specification from NOTES.md to implement the act-loop bridge with proper tool call handling and round management.

### MCP Integration
The `MCPProvider` will act as a bridge to the `@sage/mcp` package, which handles the complexities of the MCP protocol.

```typescript
import { MCPClientManager } from '@sage/mcp';
import { BaseAdapter } from './base.js';

export class MCPAdapter extends BaseAdapter {
  private mcpManager: MCPClientManager;

  constructor(mcpManager: MCPClientManager) {
    super('mcp', {});
    this.mcpManager = mcpManager;
  }
}
```