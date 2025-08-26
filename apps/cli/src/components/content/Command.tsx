import { Row, Text } from "..";
import { theme } from "../../config";

export const Command = ({
  name,
  description
}: {
  name: string;
  description: string;
}) => (
  <Row gap={theme.padding}>
    <Text>sage</Text>
    <Text color={theme.primary}>{name}</Text>
    <Text dimColor>{description}</Text>
  </Row>
);
