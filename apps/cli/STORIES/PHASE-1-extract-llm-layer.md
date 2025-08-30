# STORY: Extract LLM Layer to @sage/llm

## Overview
Extract the working LLM provider implementations from the CLI app into a standalone `@sage/llm` package, creating a provider-agnostic bridge to Large Language Models.

## Current State
The CLI app contains fully functional LLM integration with:
- ✅ OpenAI provider with streaming and tool calls (`src/models/OpenAIModel.ts`)
- ✅ Qwen provider implementation (`src/models/QwenModel.ts`)
- ✅ Model selection and management (`src/models/actions.ts`, `src/models/state.ts`)
- ✅ Streaming support with backpressure handling
- ✅ Tool call validation and execution
- ✅ Error handling and abort controllers

## Success Criteria
- [ ] `@sage/llm` package created with clean API
- [ ] OpenAI provider extracted and working
- [ ] Qwen provider extracted and working
- [ ] Unified streaming interface
- [ ] Tool call integration maintained
- [ ] CLI updated to consume `@sage/llm`
- [ ] All existing functionality preserved
- [ ] Tests passing for both packages

## Implementation Plan

### Step 1: Create @sage/llm Package Structure
```bash
packages/llm/
├── src/
│   ├── index.ts              # Main exports
│   ├── providers/
│   │   ├── openai.ts         # OpenAI provider
│   │   ├── qwen.ts           # Qwen provider
│   │   └── base.ts           # Base provider interface
│   ├── streaming/
│   │   ├── events.ts         # Stream event types
│   │   └── utils.ts          # Streaming utilities
│   ├── tools/
│   │   ├── integration.ts    # Tool calling integration
│   │   └── validation.ts     # Tool validation
│   └── types.ts              # Core types and interfaces
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Step 2: Define Core Interfaces
```typescript
// Core API from CLI audit
export interface LLMProvider {
  name: string;
  act(chat: Chat, tools: Tool[], options: ActOptions): Promise<void>;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
}

export type StreamEvent = 
  | { type: "text"; value: string }
  | { type: "tool_call"; toolName: string; arguments: unknown; callId: string }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "end"; usage?: { prompt: number; completion: number } };
```

### Step 3: Extract and Adapt Providers
1. **Extract OpenAI Provider**
   - Move `apps/cli/src/models/OpenAIModel.ts` → `packages/llm/src/providers/openai.ts`
   - Adapt to unified interface
   - Remove CLI-specific dependencies
   - Preserve all streaming and tool call logic

2. **Extract Qwen Provider**
   - Move `apps/cli/src/models/QwenModel.ts` → `packages/llm/src/providers/qwen.ts`
   - Adapt to unified interface
   - Handle auth and device flow

3. **Create Provider Management**
   - Extract `apps/cli/src/models/actions.ts` logic
   - Implement `setProvider()`, `getProvider()`, `listModels()`

### Step 4: Streaming Integration
1. **Stream Event System**
   - Extract streaming patterns from CLI
   - Create unified `StreamEvent` types
   - Handle backpressure and cancellation

2. **Tool Integration**
   - Extract tool call handling from `act.ts`
   - Create tool schema validation
   - Preserve guard/confirmation flow

### Step 5: Update CLI Integration
1. **Update Dependencies**
   ```json
   {
     "dependencies": {
       "@sage/llm": "workspace:*"
     }
   }
   ```

2. **Replace Model Usage**
   ```typescript
   // Before
   import { OpenAIModel } from "./models/OpenAIModel.js";
   
   // After
   import { setProvider, OpenAIProvider, createChatStream } from "@sage/llm";
   ```

3. **Update act.ts**
   - Replace direct model calls with `@sage/llm` API
   - Maintain existing streaming behavior
   - Preserve tool call confirmation flow

### Step 6: Testing and Validation
1. **Package Tests**
   - Unit tests for each provider
   - Streaming integration tests
   - Tool call validation tests

2. **CLI Integration Tests**
   - Verify chat functionality works
   - Test model switching
   - Validate tool calls still work
   - Performance regression tests

## Files to Change

### New Files
- `packages/llm/` (entire package)

### Modified Files
- `apps/cli/package.json` (add dependency)
- `apps/cli/src/threads/utils/act.ts` (use new API)
- `apps/cli/src/models/` (remove or update imports)
- `apps/cli/src/threads/messaging/actions.ts` (update model usage)

### Deleted Files
- `apps/cli/src/models/OpenAIModel.ts` (moved)
- `apps/cli/src/models/QwenModel.ts` (moved)
- `apps/cli/src/models/actions.ts` (logic moved)
- `apps/cli/src/models/state.ts` (logic moved)

## Risk Mitigation
- **Low Risk**: CLI has clean model abstraction
- **Main Risk**: Breaking streaming behavior or tool calls
- **Mitigation**: Comprehensive integration tests before extraction

## Dependencies
- Must work with existing `@sage/utils` for logging
- Should integrate with future `@sage/tools` for tool schemas
- Compatible with `@sage/mcp` for MCP provider

## Success Validation
1. `pnpm build` succeeds in both packages
2. `pnpm test` passes in both packages  
3. `sage ask` command works identically to before
4. Model switching still works in CLI
5. Tool calls and confirmations work
6. Performance is equivalent or better

## Next Phase
With LLM layer extracted, Phase 2 can build `@sage/tools` and integrate with the new provider system.