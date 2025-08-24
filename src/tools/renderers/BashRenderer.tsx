import type { FC } from "react";
import { Text } from "@/components/index.js";
import type { ToolRendererProps } from "../registry.js";

export const BashRenderer: FC<ToolRendererProps> = ({ args }) => {
  const command = String(args.command || "").trim();
  return command ? <Text>Bash → {command}</Text> : <Text>Bash</Text>;
};
