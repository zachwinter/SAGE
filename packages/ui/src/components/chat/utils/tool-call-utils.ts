import type { ToolCallRequest } from "@lmstudio/sdk";
import type { StreamingToolCall } from "@/threads/state/state.js";

export type UnifiedToolCall = {
  // Unified identifier
  id: string;
  toolCallId?: string;

  // Basic tool info
  name: string;
  args: string | Record<string, unknown>;

  // State indicators
  isStreaming: boolean;
  isCompleted: boolean;
  hasError?: boolean;
  errorMessage?: string;

  // Optional result (for completed calls)
  result?: unknown;

  // Internal tracking
  streamingId?: number;
  createdAt?: number;
};

/**
 * Generate a stable, consistent key for both streaming and static tool calls.
 * This ensures proper React reconciliation when tool calls transition between states.
 */
export function generateToolCallKey(toolCall: UnifiedToolCall): string {
  // Prefer toolCallId if available (for completed tool calls)
  if (toolCall.toolCallId) {
    return `tool-${toolCall.toolCallId}`;
  }

  // For streaming tool calls, use a combination approach
  if (toolCall.isStreaming && toolCall.streamingId !== undefined) {
    return `streaming-${toolCall.streamingId}`;
  }

  // Fallback to basic id
  return `tool-${toolCall.id}`;
}

/**
 * Convert a streaming tool call to the unified format
 */
export function normalizeStreamingToolCall(
  toolCall: StreamingToolCall
): UnifiedToolCall {
  return {
    id: toolCall.toolCallId || `streaming-${toolCall.id}`,
    toolCallId: toolCall.toolCallId,
    name: toolCall.name || "",
    args: toolCall.arguments || "",
    isStreaming: true,
    isCompleted: false,
    hasError: toolCall.hasError,
    errorMessage: toolCall.errorMessage,
    streamingId: toolCall.id,
    createdAt: toolCall.createdAt
  };
}

/**
 * Convert a static tool call request to the unified format
 */
export function normalizeStaticToolCall(
  request: ToolCallRequest,
  result?: unknown
): UnifiedToolCall {
  return {
    id: request.id,
    toolCallId: request.id,
    name: request.name,
    args: request.arguments || {},
    isStreaming: false,
    isCompleted: true,
    result
  };
}

/**
 * Process tool arguments to ensure consistent display between streaming and completed states
 */
export function processToolArguments(
  args: string | Record<string, unknown>
): Record<string, any> {
  if (typeof args === "string") {
    // Handle streaming string format with improved parsing
    const parsedArgs: Record<string, string> = {};

    try {
      // Handle streaming completion of parameters
      const completedRegex = /<parameter=([^>]+)>(.*?)<\/parameter>/gs;
      let match;

      // Process completed parameters
      while ((match = completedRegex.exec(args)) !== null) {
        const key = match[1].trim();
        const value = match[2];
        parsedArgs[key] = value;
      }

      // Handle incomplete parameters at the end of stream
      const incompleteMatch = args.match(/<parameter=([^>]+)>([^<]*)$/);
      if (incompleteMatch) {
        const key = incompleteMatch[1].trim();
        const value = incompleteMatch[2];
        // Only add if it's a meaningful partial value
        if (value.length > 0 || !parsedArgs[key]) {
          parsedArgs[key] = value;
        }
      }
    } catch (error) {
      // Fallback for malformed streaming content
      console.warn("Error parsing streaming tool arguments:", error);
      return { raw_content: args };
    }

    return parsedArgs;
  } else if (typeof args === "object" && args !== null) {
    // Handle completed object format - ensure consistent serialization
    const normalizedArgs: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
      // Normalize values to ensure consistent display between streaming and completed
      if (typeof value === "string") {
        normalizedArgs[key] = value;
      } else if (value === null || value === undefined) {
        normalizedArgs[key] = "";
      } else {
        // Properly serialize objects instead of using String() which creates [object Object]
        normalizedArgs[key] =
          typeof value === "object" && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value);
      }
    }

    return normalizedArgs;
  }

  return {};
}
