import { Box, Column, Row, Text } from "@/components/index.js";
import { MCPServer } from "@/mcp/index.js";

interface MCPServerListItemProps {
  server: MCPServer;
  isSelected: boolean;
  isInstalled: boolean;
  loading: boolean;
}

export const MCPServerListItem = ({
  server,
  isSelected,
  isInstalled,
  loading
}: MCPServerListItemProps) => {
  return (
    <Box
      paddingLeft={1}
      borderStyle={isSelected ? "round" : undefined}
      borderColor={isSelected ? "magenta" : undefined}
    >
      <Column>
        <Row gap={1}>
          <Text color="magenta">{server.name}</Text>
          <Text dimColor>({server.github.replace("https://github.com/", "")})</Text>
          <Text>{server.short_description}</Text>
          {loading ? (
            <Text color="yellow">...</Text>
          ) : isInstalled ? (
            <Text color="green">✓ installed</Text>
          ) : (
            <Text color="blue">press enter to install</Text>
          )}
        </Row>
      </Column>
    </Box>
  );
};
