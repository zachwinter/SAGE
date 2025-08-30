# @sage/mcp

> "The Universal Translator for Model Control."

**📋 For documentation updates, see [TODO.md](./TODO.md) for specific instructions and workflow.**

## Overview

`@sage/mcp` (Model Control Program) is a **production-grade implementation of the Model Context Protocol (MCP)**, an industry standard for integrating AI models with development tools and enterprise systems. It provides robust server lifecycle management and multi-transport support, making it a cornerstone of SAGE's AI infrastructure.

The package is an **active and valuable complement to `@sage/llm`**. While `@sage/llm` offers a unified, provider-agnostic interface for LLM interactions, `@sage/mcp` specializes in the low-level details of the MCP protocol, ensuring stable and efficient communication with compliant endpoints.

## Installation

```bash
pnpm add @sage/mcp
```

## Quick Start

```typescript
import { MCPClientManager } from '@sage/mcp';
import { createChatStream, setProvider } from '@sage/llm';
import { MCPProvider } from '@sage/llm/providers';

// Minimal, copy-pasteable example demonstrating primary use case
// @sage/mcp manages the connection to an MCP-compliant server
const mcpManager = new MCPClientManager({ 
  // Configuration for MCP server connection
  // This could be stdio or HTTP based
});

// Create the MCP provider for use with @sage/llm
const mcpProvider = new MCPProvider(mcpManager);

// The rest of the application uses the unified @sage/llm interface
setProvider(mcpProvider);

const stream = await createChatStream({ 
  model: "claude-3.5-sonnet", 
  messages: [{ role: "user", content: "Hello, world!" }] 
});

for await (const chunk of stream) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.value);
  }
}
```

## Core API

### MCP Client Management

The main classes for managing MCP servers and connections:

```typescript
// Key method signatures with examples
class MCPClientManager {
  /**
   * Initialize the MCP client manager
   */
  constructor(config?: MCPManagerConfig) {
    // Initialize with configuration
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverConfig: McpServerConfig): Promise<McpServerConnection> {
    // Connect to an MCP server
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    // Disconnect from an MCP server
  }

  /**
   * List available tools from connected servers
   */
  async listTools(): Promise<McpTool[]> {
    // List available tools
  }

  /**
   * List available resources from connected servers
   */
  async listResources(): Promise<McpResource[]> {
    // List available resources
  }

  /**
   * List available prompts from connected servers
   */
  async listPrompts(): Promise<McpPrompt[]> {
    // List available prompts
  }
}
```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/utils](../utils/README.md)** — Provides shared types, error handling, and utilities
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)** — Official MCP SDK for protocol implementation

### Dependents  
- **[@sage/llm](../llm/README.md)** — Uses MCP as a provider through MCPProvider integration
- **[CLI applications](../../apps/cli/README.md)** — CLI tools that need to interact with MCP-compliant servers

## Development Status

![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

The MCP package is production-ready with comprehensive test coverage and enterprise-grade features. It provides robust server management and seamless integration with the unified `@sage/llm` interface.

**✅ Core Features:**
- Complete MCP protocol implementation
- Server lifecycle management
- Multi-transport support (stdio, HTTP)
- Connection pooling and error recovery
- Integration with @sage/llm via MCPProvider

**✅ Testing Infrastructure:**
- 20+ comprehensive test files
- Unit, integration, and E2E tests
- Error recovery testing
- Real MCP server process testing

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build
```

## Contract

This package implements the **[MCP Contract](./CONTRACT.md)**, which defines:
- Production-grade MCP protocol implementation
- Robust server lifecycle management
- Multi-transport support for stdio and HTTP
- Integration with @sage/llm through MCPProvider

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.

---

*Part of [SAGE](../../README.md) — A Codebase is a Living Society*