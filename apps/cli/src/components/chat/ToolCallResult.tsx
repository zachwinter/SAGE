import { Code, Column } from "@/components/index.js";
import { getLanguageOrExtension } from "@/tools/utils/language.js";
import { memo, useMemo } from "react";

export const ToolCallResult = memo(
  ({
    content,
    toolArgs
  }: {
    content: unknown;
    toolArgs?: Record<string, unknown>;
  }) => {
    const { displayContent, language } = useMemo(() => {
      let processedContent: string;

      // Handle new standardized { success: boolean, message: string } format
      if (
        typeof content === "object" &&
        content !== null &&
        "success" in content &&
        "message" in content
      ) {
        // This is our standardized tool response format
        const toolResponse = content as { success: boolean; message: string };
        processedContent = toolResponse.message;
      } else if (typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          // Check if parsed content is also our standardized format
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
          processedContent = content;
        }
      } else if (typeof content === "object" && content !== null) {
        processedContent = JSON.stringify(content, null, 2);
      } else {
        processedContent = String(content);
      }

      // Truncate if too many lines
      const maxLines = 5;
      const lines = processedContent.split("\n");
      if (lines.length > maxLines) {
        processedContent =
          lines.slice(0, maxLines).join("\n") +
          `\n\n[ + ${lines.length - maxLines} more lines ]`;
      }

      // Use shared language detection utility
      const path = toolArgs?.file_path ?? toolArgs?.path;
      const detectedLanguage =
        typeof path === "string" ? getLanguageOrExtension(path) : undefined;

      return { displayContent: processedContent, language: detectedLanguage };
    }, [content, toolArgs]);

    return (
      <>
        <Column
          paddingLeft={3}
          paddingBottom={2}
        >
          <Code language={language}>{displayContent}</Code>
        </Column>
      </>
    );
  }
);

ToolCallResult.displayName = "ToolCallResult";
