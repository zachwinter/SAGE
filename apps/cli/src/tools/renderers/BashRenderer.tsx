import type { FC } from "react";
import { Text } from "../../components";
import type { ToolRendererProps } from "../registry";

export const BashRenderer: FC<ToolRendererProps> = ({ args }) => {
  const command = String(args.command || "").trim();
  return command ? <Text>Bash → {command}</Text> : <Text>Bash</Text>;
};
