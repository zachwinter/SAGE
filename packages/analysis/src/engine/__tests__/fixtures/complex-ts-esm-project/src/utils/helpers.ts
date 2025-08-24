// src/utils/helpers.ts
import { User, FeatureFlags, GetReturnType, EventName, Calculator, MethodDecorator, ClassDecorator } from '../../types/common';

// Simple logging utility
export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }
  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  static error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }

  // A simple method decorator
  static logMethod: MethodDecorator = (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      Logger.info(`Executing ${String(propertyKey)} with args:`, args);
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

// A class decorator (conceptual, won't do much)
export const Deprecated: ClassDecorator = (target) => {
  Logger.warn(`Class ${target.name} is deprecated.`);
  return target;
};

// A generator function
export function* idGenerator(): Generator<number, void, unknown> {
  let id = 0;
  while (true) {
    yield id++;
  }
}

// Function using generics and conditional types
export function processUserData<T extends User | Partial<User>>(data: T): T extends User ? User : Partial<User> {
  if ('createdAt' in data && data.createdAt instanceof Date) {
    Logger.info(`Processing full user: ${data.name}`);
    return data as T extends User ? User : Partial<User>;
  } else {
    Logger.info(`Processing partial user.`);
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as T extends User ? User : Partial<User>;
  }
}

// Overloaded function implementation
export function sum(a: number, b: number): number;
export function sum(a: string, b: string): string;
export function sum(a: any, b: any): any {
  return a + b;
}

// Function with error handling
export function safeParseJSON(jsonString: string): object | null {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    Logger.error('Failed to parse JSON:', error);
    return null;
  }
}

// Class implementing an interface with 'this' type
@Deprecated
export class SimpleCalculator implements Calculator {
  value: number;

  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  @Logger.logMethod
  add(this: SimpleCalculator, num: number): SimpleCalculator {
    this.value += num;
    return this;
  }

  subtract(num: number): this {
    this.value -= num;
    return this;
  }

  static multiply(a: number, b: number): number {
    return a * b;
  }
}

// Example usage of FeatureFlags
export const appFeatures: FeatureFlags<'darkMode' | 'notifications'> = {
  enableDarkMode: true,
  enableNotifications: false,
};

// Example usage of GetReturnType
type ProcessUserResult = GetReturnType<typeof processUserData>;

// Example usage of EventName
type UserEvent = EventName<'user'>; // "userEvent" | "userChanged"
