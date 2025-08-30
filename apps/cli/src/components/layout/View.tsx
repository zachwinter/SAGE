import { useInput } from "ink";
import type { FC } from "react";
import { useCallback, useState } from "react";
import { Column, Header, SearchableSelect } from "../../components";
import { theme } from "../../config";
import { cycleView } from "../../router/actions";

export interface KeyBinding {
  key: string;
  action: () => void;
  label: string;
}

interface ViewProps {
  title?: string;
  children?: React.ReactNode;
  onInput?: (input: string, key: any) => void;
  keyBindings?: KeyBinding[];
  showKeyBindings?: boolean;
}

export const View: FC<ViewProps> = ({
  title,
  children,
  onInput,
  keyBindings,
  showKeyBindings
}) => {
  const keys = keyBindings?.map?.(v => ({ label: v.label, value: v.key }));
  const [textInputFocused, setTextInputFocused] = useState(false);

  const handleKeySelect = useCallback(
    (value: string) => {
      const binding = keyBindings?.find(b => b.key === value);
      if (binding) {
        binding.action();
      }
    },
    [keyBindings]
  );

  const handleInput = useCallback(
    (
      input: string,
      key: {
        escape: boolean;
        shift: boolean;
        tab: boolean;
        delete: boolean;
        return: boolean;
        up: boolean;
        down: boolean;
      }
    ) => {
      // Check if we're in a text input (character keys without special modifiers)
      const isTextInput = input.length === 1 && !key.escape && !key.tab && !key.delete && !key.return && !key.up && !key.down;
      
      if (key.shift && key.tab) return cycleView();
      
      // Only process key bindings for special keys or when not in text input
      if (!isTextInput || key.escape) {
        findAndCallActionHandlers(input, key);
      }
      
      onInput?.(input, key);
    },
    [onInput, keyBindings]
  );

  function findAndCallActionHandlers(
    input: string,
    key: { escape: boolean; delete: boolean; shift: boolean; return: boolean; up: boolean; down: boolean }
  ) {
    if (!keyBindings) return;
    for (const binding of keyBindings) {
      const keyToMatch = binding.key.toLowerCase();
      const inputToMatch = input.toLowerCase();
      const isEscapeKey = binding.key === "escape" && key.escape;
      const isBackspace = binding.key === "delete" && key.delete && !key.shift;
      const isShiftBackspace = binding.key === "shift+delete" && key.delete && key.shift;
      const isReturnKey = binding.key === "return" && key.return;
      const isUpKey = binding.key === "up" && key.up;
      const isDownKey = binding.key === "down" && key.down;
      
      if (inputToMatch === keyToMatch || isEscapeKey || isBackspace || isShiftBackspace || isReturnKey || isUpKey || isDownKey) {
        return binding.action();
      }
    }
  }

  useInput(handleInput);

  const showSearch = showKeyBindings !== false && keyBindings && keys;
  return (
    <Column
      paddingLeft={theme.padding}
      paddingRight={theme.padding}
    >
      {title && <Header title={title} />}
      <Column>
        {children}
        {showSearch && (
          <SearchableSelect
            showInput={false}
            options={keys}
            onChange={handleKeySelect}
          />
        )}
      </Column>
    </Column>
  );
};
