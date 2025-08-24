import type { FC } from "react";
import { Text } from "@/components/index.js";
import type { ToolRendererProps } from "../registry.js";

export const ReadRenderer: FC<ToolRendererProps> = ({ args }) => {
  const filePath = String(args.file_path || "").trim();
  return filePath ? <Text>Read → {filePath}</Text> : <Text>Read</Text>;
};
