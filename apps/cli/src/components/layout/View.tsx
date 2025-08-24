import { useInput } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import type { FC } from "react";
import { useCallback } from "react";
import { Column, SearchableSelect } from "../../components";
import { theme } from "../../config";
import { cycleView } from "../../router/actions";

export interface KeyBinding {
  key: string;
  action: () => void;
  label: string;
}

interface ViewProps {
  title: string;
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
      }
    ) => {
      if (key.shift && key.tab) return cycleView();
      findAndCallActionHandlers(input, key);
      onInput?.(input, key);
    },
    [onInput, keyBindings]
  );

  function findAndCallActionHandlers(
    input: string,
    key: { escape: boolean; delete: boolean; return: boolean }
  ) {
    if (!keyBindings) return;
    for (const binding of keyBindings) {
      const keyToMatch = binding.key.toLowerCase();
      const inputToMatch = input.toLowerCase();
      const isEscapeKey = binding.key === "escape" && key.escape;
      const isBackspace = binding.key === "delete" && key.delete;
      const isReturnKey = binding.key === "return" && key.return;
      if (inputToMatch === keyToMatch || isEscapeKey || isBackspace || isReturnKey)
        return binding.action();
    }
  }

  useInput(handleInput);

  const showSearch = showKeyBindings !== false && keyBindings && keys;
  return (
    <Column
      paddingLeft={theme.padding}
      paddingRight={theme.padding}
    >
      {/**
       *'cristal'
       *'teen'
       *'mind'
       *'morning'
       *'vice'
       *'passion'
       *'fruit'
       *'instagram'
       *'atlas'
       *'retro'
       *'summer'
       *'pastel'
       *'rainbow'
       */}
      <Gradient name="teen">
        <BigText
          text={title}
          font="block"
        />
      </Gradient>
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
