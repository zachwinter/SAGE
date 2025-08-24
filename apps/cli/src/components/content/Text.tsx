import { Text as InkText, type TextProps as InkTextProps } from "ink";
import type { FC } from "react";

const themes = {
  primary: { color: "white", bold: false },
  accent: { color: "magenta", bold: false },
  viewTitle: { color: "magenta" },
  bold: { bold: true },
  listTitle: { underline: true },
  error: { color: "red", bold: false }
} as const;

type ThemeVariant = keyof typeof themes;

interface ThemedTextProps extends InkTextProps {
  variant?: ThemeVariant;
  children?: React.ReactNode;
}

export const Text: FC<ThemedTextProps> = ({
  variant = "primary",
  children,
  ...inkProps
}) => {
  return (
    <InkText
      {...themes[variant]}
      {...inkProps}
    >
      {children}
    </InkText>
  );
};
