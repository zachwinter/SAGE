// src/adapters/mcp.ts
// MCP adapter placeholder - will be implemented when @sage/mcp is available

import type { ChatOptions, StreamEvent, ChatMessage, ToolSchema, ModelInfo } from '../types.js';
import { BaseAdapter, type ProviderConfig, ProviderError } from './base.js';

/**
 * MCP-specific configuration
 */
export interface MCPConfig extends ProviderConfig {
  // MCP configuration will be added when @sage/mcp is available
}

/**
 * MCP adapter implementation (placeholder)
 */
export class MCPAdapter extends BaseAdapter {
  constructor(config: MCPConfig) {
    super('mcp', config);
    
    // Placeholder implementation - will be replaced when @sage/mcp is available
    console.warn('MCP adapter is a placeholder - full implementation requires @sage/mcp');
  }

  async *chat(opts: ChatOptions): AsyncIterable<StreamEvent> {
    this.validateChatOptions(opts);
    
    throw new ProviderError(
      'MCP adapter is not yet implemented - full implementation requires @sage/mcp', 
      'NOT_IMPLEMENTED'
    );
  }

  async models(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mcp-placeholder',
        name: 'MCP Placeholder',
        description: 'Placeholder for Model Context Protocol integration',
        supportsStreaming: false,
        supportsToolCalls: false,
        contextWindow: 0,
        maxTokens: 0
      }
    ];
  }

  /**
   * Estimate token count
   */
  protected estimateTokenCount(opts: ChatOptions): number {
    // Rough estimation
    const messageText = opts.messages.map(m => m.content).join(' ');
    const baseTokens = Math.ceil(messageText.length / 4);
    
    // Add overhead for message structure
    const messageOverhead = opts.messages.length * 3;
    
    // Add tool schema overhead
    const toolOverhead = opts.tools ? opts.tools.length * 20 : 0;
    
    return baseTokens + messageOverhead + toolOverhead;
  }
}