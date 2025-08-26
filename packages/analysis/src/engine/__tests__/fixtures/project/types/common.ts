// types/common.ts

// Basic types
export type ID = string | number;

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// Recursive type for a nested menu structure
export type MenuItem = {
  id: ID;
  label: string;
  children?: MenuItem[];
  action?: (payload: unknown) => void;
};

// Mapped type with key remapping and conditional types
export type FeatureFlags<T extends string> = {
  [K in T as `enable${Capitalize<K>}`]: boolean;
};

// Conditional type for extracting return type of a function
export type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Template literal types for event names
export type EventName<T extends string> = `${T}Event` | `${T}TChanged`;

// Indexed access type
export type UserProperty = keyof User;

// Discriminated Union
export type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number }
  | { kind: "rectangle"; width: number; height: number };

// Type predicate
export function isCircle(shape: Shape): shape is { kind: "circle"; radius: number } {
  return shape.kind === "circle";
}

// A more complex interface with optional properties and readonly
export interface User extends Timestamped {
  id: ID;
  name: string;
  email: string;
  age?: number;
  readonly roles: string[];
  preferences?: Record<string, unknown>;
}

// Utility type: DeepPartial
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// A type that uses infer in a more complex way
export type ExtractPromiseType<T> = T extends Promise<infer U> ? U : T;

// Overloaded function types
export type Sum = {
  (a: number, b: number): number;
  (a: string, b: string): string;
};

// A type that uses 'this'
export interface Calculator {
  value: number;
  add(this: Calculator, num: number): Calculator;
  subtract(num: number): this;
}

// A type for a generator function
export type NumberGenerator = () => Generator<number, void, unknown>;

// A type for a decorator
export type MethodDecorator = (
  target: Object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) => PropertyDescriptor | void;

// A type for a class decorator
export type ClassDecorator = <TFunction extends Function>(
  target: TFunction
) => TFunction | void;
