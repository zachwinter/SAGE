import { Box } from "./Box";
import type { FC } from "react";
import type { BoxProps } from "ink";

interface RowProps extends Omit<BoxProps, "flexDirection"> {
  children?: React.ReactNode;
}

export const Row: FC<RowProps> = ({ children, ...props }) => (
  <Box
    flexDirection="row"
    {...props}
  >
    {children}
  </Box>
);
