import { createHash } from "crypto";
import type { LLMClient, ChatOptions, StreamEvent } from "./types.js";

/**
 * Deterministic LLM adapter for testing
 * Generates consistent responses based on seeded randomness
 */
export class TestLLMClient implements LLMClient {
  private seed: number;
  private tools: Record<string, (input: any) => Promise<any>>;
  private responseTemplates: Map<string, string[]>;

  constructor(options: {
    seed?: number;
    tools?: Record<string, (input: any) => Promise<any>>;
  } = {}) {
    this.seed = options.seed || 42;
    this.tools = options.tools || {};
    this.responseTemplates = new Map();
    
    // Set up default response templates
    this.initializeResponseTemplates();
  }

  async createChatStream(opts: ChatOptions): Promise<AsyncIterable<StreamEvent>> {
    const { messages, tools } = opts;
    
    // Generate deterministic response based on input hash
    const inputHash = this.hashInput(messages);
    const response = this.generateResponse(inputHash, messages, tools);
    
    return this.createStream(response);
  }

  private initializeResponseTemplates(): void {
    this.responseTemplates.set('greeting', [
      'Hello! How can I help you today?',
      'Hi there! What can I do for you?',
      'Greetings! How may I assist?',
    ]);
    
    this.responseTemplates.set('plan', [
      'I\'ll create a plan to address your request.',
      'Let me draft a plan for this task.',
      'Here\'s my proposed approach:',
    ]);
    
    this.responseTemplates.set('code', [
      'I\'ll help you implement this functionality.',
      'Let me write some code for that.',
      'Here\'s the implementation you need:',
    ]);
    
    this.responseTemplates.set('default', [
      'I understand your request and will help.',
      'Let me process that for you.',
      'I\'ll work on that right away.',
    ]);
  }

  private hashInput(messages: Array<{ role: string; content: string }>): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    return createHash('sha256')
      .update(`${this.seed}:${content}`)
      .digest('hex');
  }

  private generateResponse(
    inputHash: string, 
    messages: Array<{ role: string; content: string }>,
    tools?: Record<string, any>
  ): {
    text?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      args: any;
    }>;
  } {
    // Use hash to seed pseudo-random generation
    const rng = this.createSeededRng(inputHash);
    
    // Determine response type based on message content
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    
    let responseType = 'default';
    if (lastMessage.includes('hello') || lastMessage.includes('hi')) {
      responseType = 'greeting';
    } else if (lastMessage.includes('plan') || lastMessage.includes('implement')) {
      responseType = 'plan';
    } else if (lastMessage.includes('code') || lastMessage.includes('function')) {
      responseType = 'code';
    }
    
    // Generate text response
    const templates = this.responseTemplates.get(responseType) || this.responseTemplates.get('default')!;
    const template = templates[Math.floor(rng() * templates.length)];
    
    // Check if we should emit tool calls
    const shouldCallTool = tools && Object.keys(tools).length > 0 && rng() < 0.3;
    
    if (shouldCallTool) {
      const toolNames = Object.keys(tools);
      const toolName = toolNames[Math.floor(rng() * toolNames.length)];
      
      return {
        text: `I'll use the ${toolName} tool to help with this.`,
        toolCalls: [{
          id: `call_${inputHash.substring(0, 8)}`,
          name: toolName,
          args: this.generateToolArgs(toolName, lastMessage, rng),
        }],
      };
    }
    
    return { text: template };
  }

  private generateToolArgs(toolName: string, userMessage: string, rng: () => number): any {
    // Generate plausible tool arguments based on tool name and user message
    switch (toolName.toLowerCase()) {
      case 'read':
        return { file: this.extractFilename(userMessage) || 'src/index.ts' };
      
      case 'write':
        return {
          file: this.extractFilename(userMessage) || 'output.txt',
          content: 'Generated content based on your request.',
        };
      
      case 'edit':
        return {
          file: this.extractFilename(userMessage) || 'src/file.ts',
          patch: '--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n-old line\n+new line',
        };
      
      case 'bash':
        return {
          command: 'echo',
          args: ['hello', 'world'],
        };
      
      case 'graphquery':
        return {
          query: 'MATCH (n) RETURN n LIMIT 10',
          params: {},
        };
      
      default:
        // Generate generic arguments
        return { input: userMessage.substring(0, 50) };
    }
  }

  private extractFilename(text: string): string | null {
    // Simple filename extraction
    const match = text.match(/(\w+\.\w+)|([a-zA-Z0-9_/.-]+\.(ts|js|py|md|json))/);
    return match?.[0] || null;
  }

  private createSeededRng(seed: string): () => number {
    // Simple seeded PRNG using string hash
    let value = 0;
    for (let i = 0; i < seed.length; i++) {
      value = ((value << 5) - value + seed.charCodeAt(i)) & 0xffffffff;
    }
    
    return () => {
      value = (value * 1664525 + 1013904223) & 0xffffffff;
      return (value >>> 0) / 0xffffffff;
    };
  }

  private async *createStream(response: {
    text?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      args: any;
    }>;
  }): AsyncGenerator<StreamEvent> {
    // Emit text chunks if we have text
    if (response.text) {
      const chunks = this.chunkText(response.text);
      for (const chunk of chunks) {
        yield {
          type: "text",
          text: chunk,
        };
        // Add small delay for realistic streaming
        await this.sleep(10);
      }
    }

    // Emit tool calls if we have them
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        yield {
          type: "tool_call",
          toolCall: toolCall,
        };

        // Execute tool if we have it configured
        if (this.tools[toolCall.name]) {
          try {
            const result = await this.tools[toolCall.name](toolCall.args);
            yield {
              type: "tool_result",
              toolResult: {
                id: toolCall.id,
                result,
              },
            };
          } catch (error) {
            yield {
              type: "tool_result",
              toolResult: {
                id: toolCall.id,
                result: null,
                error: (error as Error).message,
              },
            };
          }
        }
      }
    }

    // Final done event
    yield {
      type: "done",
    };
  }

  private chunkText(text: string, chunkSize: number = 8): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function matching CONTRACT.md specification
 */
export function makeLLM(options: {
  seed?: number;
  tools?: Record<string, (input: any) => Promise<any>>;
} = {}): LLMClient {
  return new TestLLMClient(options);
}