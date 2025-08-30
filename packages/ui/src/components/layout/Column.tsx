import { Box } from "./Box";
import type { FC } from "react";
import type { BoxProps } from "ink";

interface ColumnProps extends Omit<BoxProps, "flexDirection"> {
  children?: React.ReactNode;
}

export const Column: FC<ColumnProps> = ({ children, ...props }) => (
  <Box
    flexDirection="column"
    {...props}
  >
    {children}
  </Box>
);
