import InkTextInput from "ink-text-input";
import type { FC } from "react";
import { Box, Text } from "../../components";
import { theme } from "../../config";

interface InputProps {
  value: string;
  setValue: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onBackspaceEmpty?: () => void;
  isConfirmationMode?: boolean;
}

export const TextInput: FC<InputProps> = ({
  value,
  setValue,
  onSubmit,
  placeholder,
  isConfirmationMode = false
}) => {
  return (
    <Box
      borderColor={isConfirmationMode ? "yellow" : "dim"}
      borderStyle={theme.border}
      paddingLeft={1}
      paddingRight={1}
    >
      {isConfirmationMode && <Text color="yellow">{placeholder}</Text>}

      {!isConfirmationMode && (
        <InkTextInput
          placeholder={placeholder}
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
        />
      )}
    </Box>
  );
};
