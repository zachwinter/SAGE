import type { FC } from "react";
import { theme } from "../../config";
import { Column } from "../layout/Column";
import { Row } from "../layout/Row";
import { Text } from "./Text";

type ErrorInput =
  | string
  | Error
  | { name?: string; message?: string; code?: string | number; stack?: string }
  | null
  | undefined;

interface ErrorProps {
  error: ErrorInput;
  showStack?: boolean;
  compact?: boolean;
}

export const Error: FC<ErrorProps> = ({
  error,
  showStack = false,
  compact = false
}) => {
  // Handle null/undefined
  if (!error) {
    return <Text variant="error">❌ Unknown error occurred</Text>;
  }

  // Handle string errors
  if (typeof error === "string") {
    return <Text variant="error">❌ {error}</Text>;
  }

  // Handle Error objects and error-like objects
  const errorObj = error as Error & { code?: string | number };
  const name = errorObj.name || "Error";
  const message = errorObj.message || "Unknown error";
  const code = errorObj.code;
  const stack = errorObj.stack;

  // Compact mode - single line
  if (compact) {
    const parts = [name];
    if (code) parts.push(`(${code})`);
    parts.push(message);

    return <Text variant="error">❌ {parts.join(" ")}</Text>;
  }

  // Full error display
  return (
    <Column
      padding={theme.padding}
      gap={1}
    >
      <Row>
        <Text variant="error">❌ </Text>
        <Text
          variant="error"
          bold
        >
          {name}
        </Text>
        {code && (
          <>
            <Text> (</Text>
            <Text variant="error">{code}</Text>
            <Text>)</Text>
          </>
        )}
      </Row>

      <Text variant="error">{message}</Text>

      {showStack && stack && (
        <Column marginTop={1}>
          <Text>Stack trace:</Text>
          <Text>{stack}</Text>
        </Column>
      )}
    </Column>
  );
};
