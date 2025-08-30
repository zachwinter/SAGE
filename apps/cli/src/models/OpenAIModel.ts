import OpenAI from "openai";
import type { Chat, ChatMessage } from "@lmstudio/sdk";
import { Logger } from "@sage/utils";

const logger = new Logger("models:OpenAIModel", "debug.log");

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

// Mock ChatMessage class to match LMStudio interface
class MockChatMessage {
  constructor(
    private role: string,
    private content: string,
    private toolCallId?: string
  ) {}

  getRole() {
    return this.role;
  }
  getContent() {
    return this.content;
  }
  getToolCallRequests() {
    // This would normally return tool call requests from the message
    // For now, return empty array as we handle this differently
    return [];
  }
}

export class OpenAIModel {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    this.model = config.model;
    logger.info(
      `🤖 OpenAI Model initialized: ${config.model} at ${config.baseURL || "https://api.openai.com"}`
    );
  }

  async act(
    chat: Chat,
    tools: any[],
    options: {
      signal: AbortSignal;
      onRoundStart?: (roundIndex: number) => void;
      onRoundEnd?: (roundIndex: number) => void;
      onPredictionFragment?: (data: any) => void;
      onPredictionCompleted?: (data: any) => void;
      onToolCallRequestStart?: (
        roundIndex: number,
        callId: number,
        info: any
      ) => void;
      onToolCallRequestNameReceived?: (
        roundIndex: number,
        callId: number,
        name: string
      ) => void;
      onToolCallRequestArgumentFragmentGenerated?: (
        roundIndex: number,
        callId: number,
        fragment: string
      ) => void;
      onToolCallRequestEnd?: (roundIndex: number, callId: number, info: any) => void;
      onMessage?: (message: any) => void;
      guardToolCall?: (
        roundIndex: number,
        callId: number,
        controller: any
      ) => Promise<void>;
    }
  ) {
    let roundIndex = 0;
    logger.info(`🚀 Starting act() with ${tools.length} tools available`);

    while (true) {
      logger.info(`🔄 Round ${roundIndex} starting`);
      options.onRoundStart?.(roundIndex);

      const messages = this.convertChatToOpenAI(chat);
      logger.info(`📝 Converted chat to ${messages.length} OpenAI messages`);

      try {
        const openaiTools = this.convertToolsToOpenAI(tools);
        logger.info(`🔧 Converted ${tools.length} tools to OpenAI format`);

        const streamParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
          model: this.model,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          stream: true
        };

        if (openaiTools.length > 0) {
          streamParams.tools = openaiTools;
        }

        const stream = await this.client.chat.completions.create(streamParams, {
          signal: options.signal
        });

        let response = "";
        let toolCalls: Map<number, any> = new Map();
        let nextCallId = 0;

        logger.info(`📡 Starting to process stream...`);

        for await (const chunk of stream) {
          if (options.signal.aborted) {
            logger.info(`🛑 Stream aborted by user`);
            throw new Error("AbortError");
          }

          const delta = chunk.choices[0]?.delta;

          // Handle content streaming
          if (delta?.content) {
            response += delta.content;
            options.onPredictionFragment?.({ content: delta.content });
          }

          // Handle tool call streaming
          if (delta?.tool_calls) {
            this.handleToolCallStreaming(
              delta.tool_calls,
              toolCalls,
              options,
              roundIndex,
              nextCallId
            );
            // Update nextCallId for any new tool calls
            for (const toolCall of delta.tool_calls) {
              if (toolCall.index !== undefined) {
                nextCallId = Math.max(nextCallId, toolCall.index + 1);
              }
            }
          }
        }

        logger.info(
          `✅ Stream completed. Response: ${response.length} chars, ${toolCalls.size} tool calls`
        );

        options.onPredictionCompleted?.({ content: response });

        // Create assistant message
        const assistantMessage = new MockChatMessage("assistant", response);

        // Add assistant message to chat
        if (response.trim()) {
          chat.append("assistant", response);
        }

        options.onMessage?.(assistantMessage);

        // Handle tool calls if any
        if (toolCalls.size > 0) {
          logger.info(`🔧 Processing ${toolCalls.size} tool calls...`);
          const toolResults = await this.executeToolCalls(
            toolCalls,
            options,
            roundIndex,
            tools
          );

          // Add tool results to chat
          for (const result of toolResults) {
            if (result.content) {
              chat.append("tool", result.content, result.tool_call_id);
              const toolMessage = new MockChatMessage(
                "tool",
                result.content,
                result.tool_call_id
              );
              options.onMessage?.(toolMessage);
            }
          }

          // Continue to next round if we have tool results
          roundIndex++;
          options.onRoundEnd?.(roundIndex - 1);
          continue;
        }

        // No tool calls, we're done
        logger.info(`🏁 Conversation complete - no more tool calls`);
        break;
      } catch (error) {
        logger.error(
          `💥 Error in act(): ${error instanceof Error ? error.message : String(error)}`
        );
        if (
          error instanceof Error &&
          (error.name === "AbortError" || options.signal.aborted)
        ) {
          throw error;
        }
        throw error;
      } finally {
        options.onRoundEnd?.(roundIndex);
      }
    }

    logger.info(`✨ Act completed successfully after ${roundIndex + 1} rounds`);
  }

  private convertChatToOpenAI(chat: Chat): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (let i = 0; i < chat.getLength(); i++) {
      const message = chat.getMessage(i);
      const role = message.getRole();
      const content = message.getContent();

      if (role === "system" || role === "user" || role === "assistant") {
        messages.push({
          role,
          content
        });
      } else if (role === "tool") {
        // Handle tool messages
        messages.push({
          role: "tool",
          content,
          tool_call_id: "tool_call_id" // This should come from the message metadata
        });
      }
    }

    logger.debug(
      `📝 Converted ${chat.getLength()} chat messages to ${messages.length} OpenAI messages`
    );
    return messages;
  }

  private convertToolsToOpenAI(tools: any[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => {
      // LMStudio tools have a .definition property with the schema
      const definition = tool.definition || tool;

      return {
        type: "function" as const,
        function: {
          name: definition.name || tool.name,
          description: definition.description || tool.description,
          parameters: this.convertZodSchemaToJsonSchema(
            definition.parameters || tool.parameters
          )
        }
      };
    });
  }

  private convertZodSchemaToJsonSchema(zodSchema: any): any {
    // Simple conversion from Zod schema to JSON Schema
    // This is a basic implementation - you might need to enhance it
    if (!zodSchema) return { type: "object", properties: {} };

    const properties: any = {};
    const required: string[] = [];

    for (const [key, schema] of Object.entries(zodSchema)) {
      const zodType = schema as any;
      let jsonType = { type: "string" }; // default

      // Basic Zod type detection
      if (zodType._def) {
        switch (zodType._def.typeName) {
          case "ZodString":
            jsonType = { type: "string" };
            break;
          case "ZodNumber":
            jsonType = { type: "number" };
            break;
          case "ZodBoolean":
            jsonType = { type: "boolean" };
            break;
          case "ZodArray":
            jsonType = { type: "array", items: { type: "any" } };
            break;
          case "ZodObject":
            jsonType = { type: "object" };
            break;
        }

        if (zodType._def.description) {
          jsonType.description = zodType._def.description;
        }

        // Check if optional
        if (!zodType.isOptional || !zodType.isOptional()) {
          required.push(key);
        }
      }

      properties[key] = jsonType;
    }

    return {
      type: "object",
      properties,
      required
    };
  }

  private handleToolCallStreaming(
    toolCallDeltas: any[],
    toolCalls: Map<number, any>,
    options: any,
    roundIndex: number,
    baseCallId: number
  ) {
    for (const delta of toolCallDeltas) {
      const index = delta.index;
      const callId = baseCallId + index;

      if (!toolCalls.has(index)) {
        // New tool call starting
        toolCalls.set(index, {
          id: delta.id,
          type: "function",
          function: { name: "", arguments: "" }
        });

        logger.info(`🔧 Tool call ${callId} started (index ${index})`);
        options.onToolCallRequestStart?.(roundIndex, callId, {
          toolCallId: delta.id
        });
      }

      const toolCall = toolCalls.get(index)!;

      if (delta.function?.name) {
        toolCall.function.name += delta.function.name;
        logger.debug(
          `🏷️  Tool call ${callId} name fragment: "${delta.function.name}"`
        );
        options.onToolCallRequestNameReceived?.(
          roundIndex,
          callId,
          delta.function.name
        );
      }

      if (delta.function?.arguments) {
        toolCall.function.arguments += delta.function.arguments;
        logger.debug(
          `📝 Tool call ${callId} args fragment: "${delta.function.arguments}"`
        );
        options.onToolCallRequestArgumentFragmentGenerated?.(
          roundIndex,
          callId,
          delta.function.arguments
        );
      }
    }
  }

  private async executeToolCalls(
    toolCalls: Map<number, any>,
    options: any,
    roundIndex: number,
    availableTools: any[]
  ): Promise<any[]> {
    const results = [];

    for (const [index, toolCall] of toolCalls.entries()) {
      const callId = index;

      logger.info(`🏁 Tool call ${callId} ended: ${toolCall.function.name}`);
      options.onToolCallRequestEnd?.(roundIndex, callId, {
        toolCallId: toolCall.id
      });

      // Find the tool implementation
      const tool = availableTools.find(
        t => (t.definition?.name || t.name) === toolCall.function.name
      );

      if (!tool) {
        logger.error(`❌ Tool not found: ${toolCall.function.name}`);
        results.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Error: Tool '${toolCall.function.name}' not found`
        });
        continue;
      }

      // Parse arguments
      let parsedArgs;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        logger.error(
          `❌ Failed to parse tool arguments for ${toolCall.function.name}: ${toolCall.function.arguments}`
        );
        results.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Error: Invalid JSON in tool arguments`
        });
        continue;
      }

      // Create mock controller for guardToolCall
      let approved = false;
      const controller = {
        toolCallRequest: {
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: parsedArgs
        },
        allow: () => {
          approved = true;
          logger.info(`✅ Tool call ${callId} approved`);
        },
        deny: (reason?: string) => {
          approved = false;
          logger.info(
            `❌ Tool call ${callId} denied: ${reason || "No reason given"}`
          );
        }
      };

      // Call guardToolCall for approval
      await options.guardToolCall?.(roundIndex, callId, controller);

      if (approved) {
        try {
          logger.info(
            `🚀 Executing tool ${toolCall.function.name} with args:`,
            parsedArgs
          );
          const result = await tool.implementation(parsedArgs);

          results.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: typeof result === "string" ? result : JSON.stringify(result)
          });

          logger.info(`✅ Tool ${toolCall.function.name} executed successfully`);
        } catch (error) {
          logger.error(
            `💥 Tool execution failed for ${toolCall.function.name}:`,
            error
          );
          results.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      } else {
        results.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "Tool execution denied by user"
        });
      }
    }

    return results;
  }
}
