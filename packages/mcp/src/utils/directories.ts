import path from "path";
import { createDirectoryManager, DirectoryManager } from "@sage/utils";

// Dependency injection versions for better testability
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

// MCP-specific directories
export function getServersDirDI(directoryManager: DirectoryManager): string {
  return path.join(getSageDirDI(directoryManager), "servers");
}
