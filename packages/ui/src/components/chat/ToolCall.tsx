import { memo, useMemo } from "react";
import { Code, Column, Text } from "../../components";
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
  const args: any = toolCall.args;
  const hasArgs = Object.keys(displayArgs).length > 0;
  let language =
    toolCall.name === "GraphQuery"
      ? "sql"
      : args?.file_path
        ? args.file_path.split(".").pop()
        : "txt";

  return (
    <Column>
      <Text>{toolCall.name}</Text>
      {hasArgs && (
        <Code language={language}>
          {Object.values(displayArgs).join("\n") as string}
        </Code>
      )}
    </Column>
  );
});
