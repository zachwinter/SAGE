import { memo, useMemo } from "react";
import { Code, Column, Text } from "../../components";
import { toolRegistry } from "../../tools/registry.js";
import { getLanguageOrExtension } from "../../tools/utils/language.js";
import {
  processToolArguments,
  type UnifiedToolCall
} from "./utils/tool-call-utils.js";

interface ToolCallProps {
  toolCall: UnifiedToolCall;
}

export const ToolCall = memo(({ toolCall }: ToolCallProps) => {
  const displayArgs = useMemo(() => {
    return processToolArguments(toolCall.args);
  }, [toolCall.args]);

  if (!toolCall.name) return null;

  // Error state
  if (toolCall.hasError) {
    return (
      <Column paddingBottom={1}>
        <Text color="red">❌ {toolCall.name}</Text>
        {toolCall.errorMessage && (
          <Text
            color="red"
            dimColor
          >
            {toolCall.errorMessage}
          </Text>
        )}
      </Column>
    );
  }

  const tool = toolRegistry.getTool(toolCall.name);

  return (
    <Column paddingBottom={1}>
      {tool?.Renderer ? (
        <tool.Renderer
          args={displayArgs}
          hasError={toolCall.hasError}
          errorMessage={toolCall.errorMessage}
        />
      ) : (
        <>
          <Text>{toolCall.name}</Text>
          {Object.keys(displayArgs).length > 0 && (
            <Column
              paddingLeft={2}
              paddingTop={1}
            >
              <Code language="json">{JSON.stringify(displayArgs, null, 2)}</Code>
            </Column>
          )}
        </>
      )}

      {toolCall.result && toolCall.isCompleted && (
        <ToolResult
          result={toolCall.result}
          args={displayArgs}
        />
      )}
    </Column>
  );
});

// Helper component for tool results
const ToolResult = memo(
  ({ result, args }: { result: unknown; args: Record<string, any> }) => {
    const { displayContent, language } = useMemo(() => {
      let processedContent: string;

      // Handle standardized tool response format
      if (
        typeof result === "object" &&
        result !== null &&
        "success" in result &&
        "message" in result
      ) {
        const toolResponse = result as { success: boolean; message: string };
        processedContent = toolResponse.message;
      } else if (typeof result === "string") {
        try {
          const parsed = JSON.parse(result);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "success" in parsed &&
            "message" in parsed
          ) {
            processedContent = parsed.message;
          } else {
            processedContent =
              typeof parsed === "object" && parsed !== null
                ? JSON.stringify(parsed, null, 2)
                : String(parsed);
          }
        } catch {
          processedContent = result;
        }
      } else if (typeof result === "object" && result !== null) {
        processedContent = JSON.stringify(result, null, 2);
      } else {
        processedContent = String(result);
      }

      // Truncate if too many lines
      const maxLines = 5;
      const lines = processedContent.split("\n");
      if (lines.length > maxLines) {
        processedContent =
          lines.slice(0, maxLines).join("\n") +
          `\n\n[ + ${lines.length - maxLines} more lines ]`;
      }

      // Detect language from file path
      const path = args?.file_path ?? args?.path;
      const detectedLanguage =
        typeof path === "string" ? getLanguageOrExtension(path) : undefined;

      return { displayContent: processedContent, language: detectedLanguage };
    }, [result, args]);

    if (!displayContent) return null;

    return (
      <Column
        paddingLeft={3}
        paddingBottom={1}
      >
        <Code language={language}>{displayContent}</Code>
      </Column>
    );
  }
);

ToolResult.displayName = "ToolResult";
ToolCall.displayName = "ToolCall";
