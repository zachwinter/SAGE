# Story 11: @sage/mcp Integration & Modernization

## Goal

Integrate `@sage/mcp` as a first-class provider within `@sage/llm`, enabling `@sage/llm` to leverage its production-grade MCP protocol implementation and enterprise server management capabilities. This story reframes the relationship from a "migration" to a strategic "integration".

## Acceptance Criteria

-   [ ] **`MCPProvider` Implementation:** An `MCPProvider` is created within `@sage/llm` that uses `@sage/mcp`'s `MCPClientManager` for communication.
-   [ ] **LM Studio SDK Migration:** The direct LM Studio SDK usage within `@sage/mcp` is migrated to a new, dedicated `LMStudioProvider` in `@sage/llm`.
-   [ ] **Preservation of MCP Core:** The core MCP protocol implementation and server management logic within `@sage/mcp` is preserved and enhanced.
-   [ ] **Unified Interface:** Consumers can use `@sage/mcp`-managed servers through the standard `@sage/llm` `createChatStream` API.
-   [ ] **Clear Documentation:** The complementary roles of `@sage/llm` and `@sage/mcp` are clearly documented.
-   [ ] **Updated Examples:** Examples are updated to show how to use the `MCPProvider`.

## Implementation Plan

### Phase 1: Provider Scaffolding

-   Define the `MCPProvider` interface within `@sage/llm`.
-   Create the basic `MCPProvider` class that takes an `MCPClientManager` instance.
-   Update `@sage/llm`'s provider registry to include the `MCPProvider`.

### Phase 2: LM Studio Provider Extraction

-   Create a new `LMStudioProvider` within `@sage/llm`.
-   Move the LM Studio-specific logic from `@sage/mcp` into this new provider.
-   Refactor any code in `apps/cli` or elsewhere that directly uses `@lmstudio/sdk` to use the new `LMStudioProvider`.

### Phase 3: `MCPProvider` Implementation

-   Implement the `createChatStream` method in `MCPProvider`, delegating the core communication to the `@sage/mcp` instance.
-   Ensure that streaming, tool-calling, and other features of `@sage/llm` work seamlessly with the `MCPProvider`.
-   Map `@sage/llm` requests and responses to the format expected by the MCP protocol.

### Phase 4: Documentation & Examples

-   Update `packages/mcp/README.md` and `packages/llm/README.md` to reflect the new architecture.
-   Create a new document, `PROVIDER-COMPARISON.md`, to explain when to use `MCPProvider`, `LMStudioProvider`, `OpenAIProvider`, etc.
-   Add examples demonstrating how to configure and use the `MCPProvider`.

## Dependencies

-   **Story 9: Provider Adapter Completion:** The provider architecture in `@sage/llm` must be mature enough to support adding new providers like `MCPProvider`.

## Estimated Effort

**4-6 hours** - The effort is focused on refactoring and integration, not a destructive migration.

## Success Metrics

-   `@sage/mcp` is successfully integrated as a provider in `@sage/llm`.
-   The LM Studio-specific logic is cleanly separated into its own provider.
-   The core MCP protocol implementation in `@sage/mcp` remains intact and functional.
-   Developers can easily use MCP-compliant servers via the unified `@sage/llm` API.
-   The documentation clearly articulates the value and role of both packages.

## Implementation Notes

### `MCPProvider` Structure

```typescript
// packages/llm/src/providers/MCPProvider.ts
import { MCPClientManager } from '@sage/mcp';
import { type LLMProvider, type ChatStreamOptions } from '@sage/llm';

export class MCPProvider implements LLMProvider {
  constructor(private mcpManager: MCPClientManager) {}

  async createChatStream(options: ChatStreamOptions) {
    // 1. Connect to the MCP server via mcpManager
    // 2. Map the llm options to the MCP chat format
    // 3. Initiate the chat and get a stream back
    // 4. Adapt the MCP stream to the @sage/llm event stream format
  }
}
```

### Consumer Usage

```typescript
// apps/cli/src/some-command.ts
import { createChatStream, setProvider } from '@sage/llm';
import { MCPProvider } from '@sage/llm/providers';
import { MCPClientManager } from '@sage/mcp';

// The CLI can now decide which provider to use based on config
const mcpManager = new MCPClientManager({ /* config */ });
setProvider(new MCPProvider(mcpManager));

// The rest of the code is provider-agnostic
const stream = await createChatStream({ model: 'some-mcp-model', messages });
```
