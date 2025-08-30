import { DirectoryManager, DirectoryManagerOptions } from "./DirectoryManager.js";
import { ProductionDirectoryManager } from "./ProductionDirectoryManager.js";
import { TestDirectoryManager } from "./TestDirectoryManager.js";

/**
 * Environment types for directory management
 */
export type Environment = "production" | "test" | "development";

/**
 * Directory Factory
 *
 * Creates the appropriate DirectoryManager based on the environment.
 * Centralizes the decision logic for which implementation to use.
 */
export class DirectoryFactory {
  /**
   * Create a DirectoryManager for the given environment
   */
  static create(
    environment: Environment = DirectoryFactory.detectEnvironment(),
    options: DirectoryManagerOptions = {}
  ): DirectoryManager {
    switch (environment) {
      case "test":
        return new TestDirectoryManager(options);

      case "development":
        // Use production manager but with custom options for development
        return new ProductionDirectoryManager({
          ...options,
          appName: options.appName || "sage-dev"
        });

      case "production":
      default:
        return new ProductionDirectoryManager(options);
    }
  }

  /**
   * Create a test directory manager with automatic cleanup
   */
  static createForTesting(
    options: DirectoryManagerOptions = {}
  ): TestDirectoryManager {
    return new TestDirectoryManager(options);
  }

  /**
   * Detect the current environment
   */
  static detectEnvironment(): Environment {
    // Check for test environment indicators
    if (
      process.env.NODE_ENV === "test" ||
      process.env.VITEST === "true" ||
      process.env.JEST_WORKER_ID !== undefined ||
      // @ts-ignore - vitest global
      typeof globalThis.vi !== "undefined" ||
      // @ts-ignore - jest global
      typeof globalThis.jest !== "undefined"
    ) {
      return "test";
    }

    // Check for development environment
    if (process.env.NODE_ENV === "development") {
      return "development";
    }

    // Default to production
    return "production";
  }

  /**
   * Create a directory manager with custom base paths
   * Useful for CLI tools that need to override default locations
   */
  static createWithBasePaths(
    basePaths: {
      userConfig?: string;
      userData?: string;
      temp?: string;
    },
    options: DirectoryManagerOptions = {}
  ): DirectoryManager {
    const environment = DirectoryFactory.detectEnvironment();

    return DirectoryFactory.create(environment, {
      ...options,
      basePaths
    });
  }

  /**
   * Factory function to create a DirectoryManager based on environment
   * This is the new preferred way to create DirectoryManagers
   */
  static createDirectoryManager(
    options?: DirectoryManagerOptions
  ): DirectoryManager {
    // Check for test environment indicators
    if (
      process.env.NODE_ENV === "test" ||
      process.env.VITEST === "true" ||
      process.env.JEST_WORKER_ID !== undefined ||
      // @ts-ignore - vitest global
      typeof globalThis.vi !== "undefined" ||
      // @ts-ignore - jest global
      typeof globalThis.jest !== "undefined"
    ) {
      return new TestDirectoryManager(options);
    }

    // Check for development environment
    if (process.env.NODE_ENV === "development") {
      return new ProductionDirectoryManager({
        ...options,
        appName: options?.appName || "sage-dev"
      });
    }

    // Default to production
    return new ProductionDirectoryManager(options);
  }
}

/**
 * Global directory manager instance
 * Automatically detects environment and creates appropriate manager
 *
 * DEPRECATED: Use DirectoryFactory.createDirectoryManager() instead for better testability
 */
let globalDirectoryManager: DirectoryManager | null = null;

/**
 * Get the global directory manager instance
 * Creates one if it doesn't exist
 *
 * DEPRECATED: Use DirectoryFactory.createDirectoryManager() instead for better testability
 */
export function getDirectoryManager(
  options?: DirectoryManagerOptions
): DirectoryManager {
  if (!globalDirectoryManager) {
    globalDirectoryManager = DirectoryFactory.create(undefined, options);
  }
  return globalDirectoryManager;
}

/**
 * Set a custom directory manager instance
 * Useful for testing or custom configurations
 *
 * DEPRECATED: Use DirectoryFactory.createDirectoryManager() instead for better testability
 */
export function setDirectoryManager(manager: DirectoryManager): void {
  globalDirectoryManager = manager;
}

/**
 * Reset the global directory manager
 * Useful for cleaning up after tests
 *
 * DEPRECATED: Use DirectoryFactory.createDirectoryManager() instead for better testability
 */
export function resetDirectoryManager(): void {
  globalDirectoryManager = null;
}
