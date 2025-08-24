import type { FC } from "react";
import { Code, Column, Text } from "../../components";
import { getLanguageFromPath } from "../../tools/utils/language";
import type { ToolRendererProps } from "../registry";

export const WriteRenderer: FC<ToolRendererProps> = ({ args }) => {
  const filePath = args.file_path || "";
  const rawContent = args.content || "";

  // Ensure content is a string - normalize for consistent display
  let content = "";

  if (typeof rawContent === "string") {
    content = rawContent;
  } else if (rawContent) {
    content = JSON.stringify(rawContent, null, 2);
  }

  const language = getLanguageFromPath(filePath);

  const displayTitle = filePath ? `Write → ${filePath}` : "Write";

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
    </Column>
  );
};
