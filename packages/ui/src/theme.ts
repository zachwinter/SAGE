import type { ReactNode } from "react";

// Theme definition
export interface Theme {
  /** Color palette */
  colors: {
    primary: string;
    dim: string;
    [key: string]: string;
  };
  /** Spacing scale */
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
  /** Border configuration */
  borders: {
    radius: number;
  };
}

// Default theme
export const defaultTheme: Theme = {
  colors: {
    primary: "#8B5CF6", // violet-500
    dim: "#6B7280", // gray-500
  },
  spacing: {
    xs: 0,
    sm: 1,
    md: 2,
    lg: 3,
  },
  borders: {
    radius: 1,
  },
};

// Theme context provider
export interface ThemeProviderProps {
  /** Theme to apply */
  value: Theme;
  /** Children to wrap with theme */
  children: ReactNode;
}

export type { ThemeProviderProps };
export const ThemeProvider = (props: ThemeProviderProps) => {
  throw new Error("ThemeProvider must be implemented by a renderer adapter");
};