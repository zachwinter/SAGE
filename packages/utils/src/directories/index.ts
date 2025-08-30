/**
 * Directory Management System (Refactored)
 *
 * Provides a clean, testable abstraction for managing application directories.
 * Uses dependency injection instead of global singletons for better testability.
 */

export type {
  DirectoryManager,
  DirectoryManagerOptions
} from "./DirectoryManagerRefactored.js";
export {
  ProductionDirectoryManager,
  TestDirectoryManager,
  createDirectoryManager
} from "./DirectoryManagerRefactored.js";

// CLI-specific utilities
export {
  getSageDirDI,
  getConfigPathDI,
  getThreadsDirDI,
  getProjectSageDirDI,
  getTempDirDI
} from "./cli-utils.js";
