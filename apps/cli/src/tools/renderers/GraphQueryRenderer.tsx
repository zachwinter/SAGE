import type { FC } from "react";
import { Box, Code, Text } from "../../components";
import type { ToolRendererProps } from "../registry.js";

type QueryResult = any[];

export const GraphQueryRenderer: FC<
  ToolRendererProps & { result?: QueryResult }
> = ({ args, result, hasError, errorMessage }) => {
  const query = String(args.query || "").trim();

  return (
    <Box flexDirection="column">
      <Text>GraphQuery</Text>
      {query && <Code language="cypher">{query}</Code>}
    </Box>
  );
};
