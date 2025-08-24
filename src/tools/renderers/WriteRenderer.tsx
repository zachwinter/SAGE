import type { FC } from "react";
import { Column, Text, Code } from "@/components/index.js";
import { getLanguageFromPath } from "@/tools/utils/language.js";
import type { ToolRendererProps } from "../registry.js";

export const WriteRenderer: FC<ToolRendererProps> = ({ args }) => {
  const filePath = args.file_path || "";
  const rawContent = args.content || "";

  // Ensure content is a string - normalize for consistent display
  let content = "";
  let isPartialContent = false;

  if (typeof rawContent === "string") {
    content = rawContent;
    // Detect if this is partial streaming content by checking for incomplete structure
    isPartialContent =
      rawContent.includes("<parameter=") && !rawContent.includes("</parameter>");
  } else if (rawContent) {
    content = JSON.stringify(rawContent, null, 2);
  }

  const language = getLanguageFromPath(filePath);

  // Show streaming indicator for partial content
  const displayTitle = filePath
    ? `Write → ${filePath}${isPartialContent ? " (streaming...)" : ""}`
    : `Write${isPartialContent ? " (streaming...)" : ""}`;

  return (
    <Column>
      <Text>{displayTitle}</Text>
      {content.trim() && (
        <Column
          paddingLeft={2}
          paddingTop={1}
        >
          <Code language={language}>{content}</Code>
        </Column>
      )}
      {!content.trim() && isPartialContent && (
        <Column
          paddingLeft={2}
          paddingTop={1}
        >
          <Text dimColor>Waiting for content...</Text>
        </Column>
      )}
    </Column>
  );
};
