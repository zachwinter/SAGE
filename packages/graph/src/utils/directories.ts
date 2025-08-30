import path from "path";
import { createDirectoryManager, type DirectoryManager } from "@sage/utils";

/**
 * Directory utilities for the graph package
 * Uses dependency injection for better testability
 */

// User-global directories - dynamic getters
export function getSageDir(directoryManager: DirectoryManager): string {
  return directoryManager.getUserDataDir();
}

export function getConfigPath(directoryManager: DirectoryManager): string {
  return path.join(directoryManager.getUserConfigDir(), "config.json");
}

export function getThreadsDir(directoryManager: DirectoryManager): string {
  return path.join(directoryManager.getUserDataDir(), "threads");
}

// Project-specific directories (for current working directory)
export function getProjectSageDir(
  directoryManager: DirectoryManager,
  cwd?: string
): string {
  return directoryManager.getProjectDir(cwd);
}

// Temporary directories
export function getTempDir(
  directoryManager: DirectoryManager,
  prefix?: string
): string {
  return directoryManager.getTempDir(prefix);
}
