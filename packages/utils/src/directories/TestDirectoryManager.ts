import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";
import { rm, mkdtemp } from "fs/promises";
import { DirectoryManager, DirectoryManagerOptions } from "./DirectoryManager.js";

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
