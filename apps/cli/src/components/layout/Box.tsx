import { Box as InkBox, type BoxProps as InkBoxProps } from "ink";
import type { FC } from "react";

interface BoxProps extends InkBoxProps {
  children?: React.ReactNode;
}

export const Box: FC<BoxProps> = ({ children, ...props }) => (
  <InkBox {...props}>{children}</InkBox>
);
