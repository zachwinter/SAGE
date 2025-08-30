import { homedir, platform, tmpdir } from "os";
import { join, resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { rm, mkdtemp } from "fs/promises";
import { DirectoryManager, DirectoryManagerOptions } from "./DirectoryManager.js";

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
