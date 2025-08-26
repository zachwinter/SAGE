// src/utils/helpers.ts
const { User, FeatureFlags, GetReturnType, EventName, Calculator, MethodDecorator, ClassDecorator } = require('../../types/common');

// Simple logging utility
class Logger {
  static info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  }
  static warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  static error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  }

  // A simple method decorator
  static logMethod = (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
      Logger.info(`Executing ${String(propertyKey)} with args:`, args);
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}
exports.Logger = Logger; // Export Logger

// A class decorator (conceptual, won't do much)
const Deprecated = (target) => {
  Logger.warn(`Class ${target.name} is deprecated.`);
  return target;
};
exports.Deprecated = Deprecated; // Export Deprecated

// A generator function
function* idGenerator() {
  let id = 0;
  while (true) {
    yield id++;
  }
}
exports.idGenerator = idGenerator; // Export idGenerator

// Function using generics and conditional types
function processUserData(data) {
  if ('createdAt' in data && data.createdAt instanceof Date) {
    Logger.info(`Processing full user: ${data.name}`);
    return data;
  } else {
    Logger.info(`Processing partial user.`);
    return { ...data, createdAt: new Date(), updatedAt: new Date() };
  }
}
exports.processUserData = processUserData; // Export processUserData

// Overloaded function implementation (TypeScript handles overloads, JS just has one implementation)
function sum(a, b) {
  return a + b;
}
exports.sum = sum; // Export sum

// Function with error handling
function safeParseJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    Logger.error('Failed to parse JSON:', error);
    return null;
  }
}
exports.safeParseJSON = safeParseJSON; // Export safeParseJSON

// Class implementing an interface with 'this' type
// Decorators are applied before export in CJS
@Deprecated
class SimpleCalculator {
  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  @Logger.logMethod
  add(num) {
    this.value += num;
    return this;
  }

  subtract(num) {
    this.value -= num;
    return this;
  }

  static multiply(a, b) {
    return a * b;
  }
}
exports.SimpleCalculator = SimpleCalculator; // Export SimpleCalculator

// Example usage of FeatureFlags
const appFeatures = {
  enableDarkMode: true,
  enableNotifications: false,
};
exports.appFeatures = appFeatures; // Export appFeatures

// Example usage of GetReturnType (type only, no runtime export needed)
// type ProcessUserResult = GetReturnType<typeof processUserData>;

// Example usage of EventName (type only, no runtime export needed)
// type UserEvent = EventName<'user'>;
