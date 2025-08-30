import path from "path";
import { DirectoryManager } from "./DirectoryManagerRefactored.js";

/**
 * CLI-specific directory utilities using dependency injection
 */

export function getSageDirDI(directoryManager: DirectoryManager): string {
  return directoryManager.getUserDataDir();
}

export function getConfigPathDI(directoryManager: DirectoryManager): string {
  return path.join(directoryManager.getUserConfigDir(), "config.json");
}

export function getThreadsDirDI(directoryManager: DirectoryManager): string {
  return path.join(directoryManager.getUserDataDir(), "threads");
}

export function getProjectSageDirDI(
  directoryManager: DirectoryManager,
  cwd?: string
): string {
  return directoryManager.getProjectDir(cwd);
}

export function getTempDirDI(
  directoryManager: DirectoryManager,
  prefix?: string
): string {
  return directoryManager.getTempDir(prefix);
}