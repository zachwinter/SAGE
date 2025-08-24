import { Box, Column, Row, Text } from "../../components/index";
import { theme } from "../../config";
import { MCPServer } from "../../mcp";
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
      borderStyle={isSelected ? theme.border : undefined}
      borderColor={isSelected ? theme.primary : undefined}
    >
      <Column>
        <Row gap={1}>
          <Text color={theme.primary}>{server.name}</Text>
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
