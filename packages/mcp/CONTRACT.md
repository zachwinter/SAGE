# MCP Contract

This document defines the behavioral guarantees and interface specifications for the `@sage/mcp` package.

## Overview

`@sage/mcp` (Model Control Program) is a **production-grade implementation of the Model Context Protocol (MCP)**, an industry standard for integrating AI models with development tools and enterprise systems. It provides robust server lifecycle management and multi-transport support, making it a cornerstone of SAGE's AI infrastructure.

This contract specifies the expected behavior, interfaces, and guarantees that the MCP implementation must provide.

## Core Guarantees

### MCP Protocol Implementation

- Provides a complete and reliable implementation of the Model Context Protocol
- Enables integration with tools like **Claude Desktop** and **VSCode extensions**
- Maintains compliance with the official MCP specification
- Supports the latest MCP features and capabilities

### Enterprise Server Management

- Manages the lifecycle of MCP servers, including discovery, connection pooling, and error recovery
- Provides robust connection management with automatic reconnection
- Implements efficient resource utilization and cleanup
- Handles server state transitions gracefully

### Multi-Transport Support

- Communicates with MCP servers over various transports, including `stdio` and `HTTP`
- Provides an adapter-based architecture for future transport expansion
- Ensures consistent behavior across different transport mechanisms
- Supports transport preference configuration

## Interface Specifications

### Main API Classes

The core MCP API provides classes for managing servers and connections:

```typescript
export type MCPServer = {
  name: string;
  github: string;
  description: string;
  short_description: string;
  tags: string[];
};

export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "http" | "adapter";
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  env?: Record<string, string>;
  transportPreference?: "http" | "stdio";
  adapterConfig?: {
    originalType: "stdio" | "http";
    adapterPort?: number;
    useStdioAdapter?: boolean;
  };
}

export interface McpServerConnection {
  id: string;
  name: string;
  config: McpServerConfig;
  client?: Client;
  status: "connecting" | "connected" | "disconnected" | "error";
  error?: string;
  capabilities?: {
    tools?: Tool[];
    resources?: Resource[];
    prompts?: Prompt[];
  };
  lastConnected?: Date;
}

export interface McpState {
  servers: Record<string, McpServerConnection>;
  serverConfigs: Record<string, McpServerConfig>;
  availableTools: McpTool[];
  availableResources: McpResource[];
  availablePrompts: McpPrompt[];
  isLoading: boolean;
  lastUpdated: number;
  selectedServer: McpServerConnection | null;
  searchState: {
    query: string;
    selectedIndex: number;
    isSearchFocused: boolean;
  };
  installationState: {
    status: Record<string, boolean>;
    loading: Record<string, boolean>;
  };
}

export interface McpTool extends Tool {
  serverId: string;
  serverName: string;
}

export interface McpResource extends Resource {
  serverId: string;
  serverName: string;
}

export interface McpPrompt extends Prompt {
  serverId: string;
  serverName: string;
}
```

### MCP Client Manager

The primary class for managing MCP servers and connections:

```typescript
/**
 * MCP Client Manager for handling server connections and lifecycle
 */
export class MCPClientManager {
  /**
   * Initialize the MCP client manager
   */
  constructor(config?: MCPManagerConfig);

  /**
   * Connect to an MCP server
   */
  async connect(serverConfig: McpServerConfig): Promise<McpServerConnection>;

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void>;

  /**
   * List available tools from connected servers
   */
  async listTools(): Promise<McpTool[]>;

  /**
   * List available resources from connected servers
   */
  async listResources(): Promise<McpResource[]>;

  /**
   * List available prompts from connected servers
   */
  async listPrompts(): Promise<McpPrompt[]>;

  /**
   * Get the current state of all servers
   */
  getState(): McpState;

  /**
   * Update server configuration
   */
  updateServerConfig(serverId: string, config: Partial<McpServerConfig>): void;

  /**
   * Remove a server configuration
   */
  removeServer(serverId: string): void;
}
```

### Configuration Management

The MCP package provides robust configuration management:

```typescript
// Standard MCP JSON configuration format
export interface McpJsonServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface McpJsonConfig {
  mcpServers: Record<string, McpJsonServerConfig>;
}

// Helper functions for configuration conversion
export function mcpJsonToServerConfig(
  name: string,
  jsonConfig: McpJsonServerConfig
): McpServerConfig;

export function serverConfigToMcpJson(config: McpServerConfig): McpJsonServerConfig;
```

## Transport Support

### Stdio Transport

- Supports local MCP servers that communicate via standard input/output
- Handles process lifecycle management
- Provides error handling for process crashes
- Supports argument passing and environment variable configuration

### HTTP Transport

- Supports remote MCP servers that communicate via HTTP
- Handles connection pooling and reuse
- Provides automatic retry mechanisms for transient failures
- Supports authentication and header configuration

### Adapter Transport

- Provides a bridge between different transport mechanisms
- Enables stdio servers to be accessed via HTTP
- Supports port configuration and process management
- Ensures consistent interface regardless of underlying transport

## Server Lifecycle Management

### Discovery

- Automatic discovery of available MCP servers
- Support for manual server registration
- Integration with standard MCP server registries
- Caching of server metadata for performance

### Connection Management

- Automatic connection establishment and maintenance
- Graceful handling of connection failures
- Reconnection with exponential backoff
- Connection pooling for efficient resource usage

### State Management

- Real-time tracking of server connection states
- Event-based notifications for state changes
- Persistence of server configurations
- Synchronization of state across multiple instances

## Error Handling

### Connection Errors

- Clear error messages for connection failures
- Automatic retry with configurable backoff
- Graceful degradation when servers are unavailable
- Detailed logging for debugging purposes

### Protocol Errors

- Proper handling of MCP protocol violations
- Validation of server responses
- Recovery from transient protocol issues
- Fallback mechanisms for critical operations

### Resource Errors

- Memory leak prevention through proper cleanup
- File descriptor management
- Process lifecycle management
- Resource usage monitoring and limits

## Security

### Transport Security

- Support for HTTPS connections
- Certificate validation and pinning
- Authentication token management
- Secure storage of sensitive configuration

### Process Isolation

- Sandboxed execution of MCP server processes
- Environment variable sanitization
- File system access restrictions
- Resource usage limits

### Data Protection

- Encryption of sensitive data at rest
- Secure transmission of credentials
- Audit logging of security-relevant events
- Compliance with data protection regulations

## Advanced Features

### Tool Management

- Automatic discovery of available tools
- Tool metadata extraction and caching
- Tool execution with proper error handling
- Integration with SAGE's tool ecosystem

### Resource Management

- Resource listing and metadata retrieval
- Content retrieval with proper error handling
- Caching of resource content for performance
- Integration with SAGE's resource access patterns

### Prompt Management

- Prompt listing and metadata retrieval
- Prompt argument validation
- Prompt execution with proper error handling
- Integration with SAGE's prompt workflows

## Testing Infrastructure

### Unit Testing

- Comprehensive coverage of core client manager functionality
- State management and configuration handling tests
- Transport-specific test cases
- Error handling and recovery tests

### Integration Testing

- Real MCP server process testing
- Concurrent operation testing
- Registry workflow validation
- Error recovery scenario testing

### End-to-End Testing

- Complete lifecycle management testing
- Installation to tool execution workflows
- Multi-server scenario testing
- Performance and scalability testing

## Future Extensions

This contract may be extended as MCP evolves to include:

- Additional transport mechanisms (WebSocket, gRPC, etc.)
- Enhanced security features (OAuth, mutual TLS, etc.)
- Advanced server management capabilities (clustering, load balancing, etc.)
- Integration with cloud-based MCP server providers
- Enhanced monitoring and observability features
- Support for MCP extensions and custom protocols