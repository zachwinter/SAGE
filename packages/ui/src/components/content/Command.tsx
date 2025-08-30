import { Row, Text } from "..";
import { theme } from "../../config";

export const Command = ({
  name,
  description,
  flags
}: {
  name: string;
  description: string;
  flags?: string[];
}) => (
  <Row gap={theme.padding}>
    <Text>sage</Text>
    <Text color={theme.primary}>{name}</Text>
    {flags && flags.length > 0 && <Text color="cyan">[{flags.join(", ")}]</Text>}
    <Text dimColor>{description}</Text>
  </Row>
);
