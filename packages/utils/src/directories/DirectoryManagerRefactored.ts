import { homedir, platform, tmpdir } from "os";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { rm } from "fs/promises";

/**
 * Directory Manager Interface
 *
 * Provides a clean abstraction for managing different types of data directories.
 * Enables dependency injection for testing and different deployment environments.
 */
export interface DirectoryManager {
  /**
   * Get the project-specific data directory (usually .sage in CWD)
   * Contains: kuzu database, analysis results, project-specific temp files
   */
  getProjectDir(cwd?: string): string;

  /**
   * Get the user configuration directory
   * Contains: user preferences, auth tokens, global settings
   * Follows OS conventions (XDG on Linux, AppData on Windows, etc.)
   */
  getUserConfigDir(): string;

  /**
   * Get the user data directory
   * Contains: chat threads, model configs, MCP server installations
   * Follows OS conventions for application data
   */
  getUserDataDir(): string;

  /**
   * Get a temporary directory for ephemeral data
   * Should be automatically cleaned up
   */
  getTempDir(prefix?: string): string;

  /**
   * Cleanup temporary directories created by this manager
   */
  cleanup(): Promise<void>;
}

/**
 * Configuration options for directory managers
 */
export interface DirectoryManagerOptions {
  /** Override the default project directory name (default: ".sage") */
  projectDirName?: string;
  /** Override the default app name for OS directories (default: "sage") */
  appName?: string;
  /** Custom base paths for testing or development */
  basePaths?: {
    userConfig?: string;
    userData?: string;
    temp?: string;
  };
}

/**
 * Production Directory Manager
 *
 * Uses OS-appropriate paths following platform conventions:
 * - Linux: XDG Base Directory Specification
 * - macOS: Standard app directories
 * - Windows: AppData directories
 */
export class ProductionDirectoryManager implements DirectoryManager {
  private tempDirs: string[] = [];
  private readonly options: DirectoryManagerOptions;

  constructor(options: DirectoryManagerOptions = {}) {
    this.options = {
      projectDirName: ".sage",
      appName: "sage",
      ...options
    };
  }

  getProjectDir(cwd: string = process.cwd()): string {
    const projectDir = join(cwd, this.options.projectDirName!);
    this.ensureDirectoryExists(projectDir);
    return projectDir;
  }

  getUserConfigDir(): string {
    if (this.options.basePaths?.userConfig) {
      const dir = this.options.basePaths.userConfig;
      this.ensureDirectoryExists(dir);
      return dir;
    }

    const configDir = this.getOSConfigDir();
    this.ensureDirectoryExists(configDir);
    return configDir;
  }

  getUserDataDir(): string {
    if (this.options.basePaths?.userData) {
      const dir = this.options.basePaths.userData;
      this.ensureDirectoryExists(dir);
      return dir;
    }

    const dataDir = this.getOSDataDir();
    this.ensureDirectoryExists(dataDir);
    return dataDir;
  }

  getTempDir(prefix: string = "sage-"): string {
    if (this.options.basePaths?.temp) {
      const baseTemp = this.options.basePaths.temp;
      this.ensureDirectoryExists(baseTemp);
      const tempDir = join(
        baseTemp,
        `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      );
      this.ensureDirectoryExists(tempDir);
      this.tempDirs.push(tempDir);
      return tempDir;
    }

    // Create a unique temp directory
    const tempDir = join(
      tmpdir(),
      `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    this.ensureDirectoryExists(tempDir);
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  async cleanup(): Promise<void> {
    const cleanupPromises = this.tempDirs.map(async dir => {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${dir}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    this.tempDirs = [];
  }

  /**
   * Get OS-appropriate configuration directory
   */
  private getOSConfigDir(): string {
    const appName = this.options.appName!;
    const os = platform();

    switch (os) {
      case "linux":
        // XDG Base Directory Specification
        return process.env.XDG_CONFIG_HOME
          ? join(process.env.XDG_CONFIG_HOME, appName)
          : join(homedir(), ".config", appName);

      case "darwin": // macOS
        return join(homedir(), "Library", "Application Support", appName);

      case "win32":
        return process.env.APPDATA
          ? join(process.env.APPDATA, appName)
          : join(homedir(), "AppData", "Roaming", appName);

      default:
        // Fallback to XDG-style for unknown platforms
        return join(homedir(), ".config", appName);
    }
  }

  /**
   * Get OS-appropriate data directory
   */
  private getOSDataDir(): string {
    const appName = this.options.appName!;
    const os = platform();

    switch (os) {
      case "linux":
        // XDG Base Directory Specification
        return process.env.XDG_DATA_HOME
          ? join(process.env.XDG_DATA_HOME, appName)
          : join(homedir(), ".local", "share", appName);

      case "darwin": // macOS - same as config on macOS
        return join(homedir(), "Library", "Application Support", appName);

      case "win32":
        return process.env.LOCALAPPDATA
          ? join(process.env.LOCALAPPDATA, appName)
          : join(homedir(), "AppData", "Local", appName);

      default:
        // Fallback to XDG-style for unknown platforms
        return join(homedir(), ".local", "share", appName);
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Test Directory Manager
 *
 * Creates isolated temporary directories for testing.
 * All directories are automatically cleaned up after tests.
 * Provides completely isolated filesystem operations for reliable testing.
 */
export class TestDirectoryManager implements DirectoryManager {
  private readonly baseTempDir: string;
  private readonly createdDirs: Set<string> = new Set();
  private readonly options: DirectoryManagerOptions;

  constructor(options: DirectoryManagerOptions = {}) {
    this.options = {
      projectDirName: ".sage",
      appName: "sage-test",
      ...options
    };

    // Create a unique base temp directory for this test session
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    this.baseTempDir = join(tmpdir(), `sage-test-${timestamp}-${random}`);
    this.ensureDirectoryExists(this.baseTempDir);
    this.createdDirs.add(this.baseTempDir);
  }

  getProjectDir(cwd?: string): string {
    // For tests, create a mock project directory in our temp space
    const mockCwd = cwd || join(this.baseTempDir, "mock-project");
    this.ensureDirectoryExists(mockCwd);
    this.createdDirs.add(mockCwd);

    const projectDir = join(mockCwd, this.options.projectDirName!);
    this.ensureDirectoryExists(projectDir);
    this.createdDirs.add(projectDir);
    return projectDir;
  }

  getUserConfigDir(): string {
    const configDir = join(this.baseTempDir, "config");
    this.ensureDirectoryExists(configDir);
    this.createdDirs.add(configDir);
    return configDir;
  }

  getUserDataDir(): string {
    const dataDir = join(this.baseTempDir, "data");
    this.ensureDirectoryExists(dataDir);
    this.createdDirs.add(dataDir);
    return dataDir;
  }

  getTempDir(prefix: string = "temp-"): string {
    const tempDir = join(
      this.baseTempDir,
      `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    this.ensureDirectoryExists(tempDir);
    this.createdDirs.add(tempDir);
    return tempDir;
  }

  async cleanup(): Promise<void> {
    // Clean up all created directories
    try {
      await rm(this.baseTempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup test directory ${this.baseTempDir}:`, error);
    }
    this.createdDirs.clear();
  }

  /**
   * Get the base temporary directory for this test session
   */
  getBaseTempDir(): string {
    return this.baseTempDir;
  }

  /**
   * Create a subdirectory within the test environment
   */
  createSubDir(relativePath: string): string {
    const fullPath = join(this.baseTempDir, relativePath);
    this.ensureDirectoryExists(fullPath);
    this.createdDirs.add(fullPath);
    return fullPath;
  }

  /**
   * Create a mock home directory structure for testing
   */
  createMockHome(): {
    homedir: string;
    sage: string;
    config: string;
    threads: string;
  } {
    const homedir = this.createSubDir("home");
    const sage = this.createSubDir("home/.sage");
    const threads = this.createSubDir("home/.sage/threads");
    const config = join(sage, "config.json");

    return {
      homedir,
      sage,
      config,
      threads
    };
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectoryExists(dir: string): void {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

/**
 * Factory function to create a DirectoryManager based on environment
 */
export function createDirectoryManager(
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
