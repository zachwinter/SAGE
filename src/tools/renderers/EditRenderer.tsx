import type { FC } from "react";
import { Column, Text } from "@/components/index.js";
import type { ToolRendererProps } from "../registry.js";
import { useMemo } from "react";

export const EditRenderer: FC<ToolRendererProps> = ({ args }) => {
  const filePath = String(args.file_path || "").trim();
  const oldString = String(args.old_string || "");
  const newString = String(args.new_string || "");

  const diffContent = useMemo(() => {
    if (!oldString.trim() && !newString.trim()) return null;

    const oldLines = oldString ? oldString.split(/\r?\n/) : [];
    const newLines = newString ? newString.split(/\r?\n/) : [];

    const oldBlock =
      oldLines.length > 0 ? oldLines.map(line => `- ${line}`).join("\n") : "";
    const newBlock =
      newLines.length > 0 ? newLines.map(line => `+ ${line}`).join("\n") : "";

    return { oldBlock: oldBlock.trim(), newBlock: newBlock.trim() };
  }, [oldString, newString]);

  return (
    <Column>
      <Text>Edit{filePath ? ` → ${filePath}` : ""}</Text>
      {diffContent && (diffContent.oldBlock || diffContent.newBlock) && (
        <Column
          paddingLeft={2}
          paddingTop={1}
        >
          {diffContent.oldBlock && <Text color="red">{diffContent.oldBlock}</Text>}
          {diffContent.newBlock && <Text color="green">{diffContent.newBlock}</Text>}
        </Column>
      )}
    </Column>
  );
};
