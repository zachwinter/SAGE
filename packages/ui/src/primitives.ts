import type { ReactNode } from "react";

// Alignment types
export type Align = "start" | "center" | "end";

// Primitive component props
export interface TextProps {
  /** Text variant styling */
  variant?: "title" | "subtitle" | "body" | "mono";
  /** Dim the text */
  dim?: boolean;
  /** Bold text */
  bold?: boolean;
  /** Wrap text */
  wrap?: boolean;
  /** Text content */
  children?: ReactNode;
}

export interface RowProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: Align;
  /** Alignment of children along the main axis */
  justify?: Align;
  /** Row content */
  children?: ReactNode;
}

export interface ColumnProps {
  /** Gap between children */
  gap?: number;
  /** Alignment of children along the cross axis */
  align?: Align;
  /** Alignment of children along the main axis */
  justify?: Align;
  /** Column content */
  children?: ReactNode;
}

export interface BoxProps {
  /** Padding around content */
  padding?: number;
  /** Margin around the box */
  margin?: number;
  /** Show border */
  border?: boolean;
  /** Rounded corners */
  rounded?: boolean;
  /** Box content */
  children?: ReactNode;
}

// Primitive components (will be implemented by adapters)
// We'll export type-only here and let the adapters provide the implementations
export type { TextProps, RowProps, ColumnProps, BoxProps };
export const Text = (props: TextProps) => {
  throw new Error("Text component must be implemented by a renderer adapter");
};

export const Row = (props: RowProps) => {
  throw new Error("Row component must be implemented by a renderer adapter");
};

export const Column = (props: ColumnProps) => {
  throw new Error("Column component must be implemented by a renderer adapter");
};

export const Box = (props: BoxProps) => {
  throw new Error("Box component must be implemented by a renderer adapter");
};