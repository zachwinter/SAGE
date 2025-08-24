import type { FC } from "react";
import InkTextInput from "ink-text-input";
import { Box } from "@/components";

interface InputProps {
  value: string;
  setValue: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onBackspaceEmpty?: () => void;
}

export const TextInput: FC<InputProps> = ({
  value,
  setValue,
  onSubmit,
  placeholder
}) => {
  return (
    <Box
      borderColor="dim"
      borderStyle={"round"}
      paddingLeft={1}
      paddingRight={1}
    >
      <InkTextInput
        placeholder={placeholder}
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
      />
    </Box>
  );
};
