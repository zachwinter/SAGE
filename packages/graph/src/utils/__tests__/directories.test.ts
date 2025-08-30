import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TestDirectoryManager } from "@sage/utils";
import path from "path";
import * as directories from "../directories.js";

describe("directories", () => {
  let testDirManager: TestDirectoryManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a test directory manager
    testDirManager = new TestDirectoryManager();
  });

  afterEach(async () => {
    await testDirManager.cleanup();
    vi.restoreAllMocks();
  });

  it("should provide user data directories via dependency injection", () => {
    // Verify that directories are provided by the DirectoryManager
    expect(directories.getSageDirDI(testDirManager)).toBe(
      testDirManager.getUserDataDir()
    );
    expect(directories.getConfigPathDI(testDirManager)).toBe(
      path.join(testDirManager.getUserConfigDir(), "config.json")
    );
    expect(directories.getThreadsDirDI(testDirManager)).toBe(
      path.join(testDirManager.getUserDataDir(), "threads")
    );
  });

  it("should provide project-specific directories via dependency injection", () => {
    // Test project directory functionality
    const projectDir = directories.getProjectSageDirDI(testDirManager);
    expect(projectDir).toBe(testDirManager.getProjectDir());

    // Test with custom CWD
    const customCwd = testDirManager.createSubDir("custom-project");
    const customProjectDir = directories.getProjectSageDirDI(
      testDirManager,
      customCwd
    );
    expect(customProjectDir).toBe(testDirManager.getProjectDir(customCwd));
  });

  it("should provide temporary directories via dependency injection", () => {
    // Test temp directory functionality
    const tempDir1 = directories.getTempDirDI(testDirManager);
    const tempDir2 = directories.getTempDirDI(testDirManager, "custom-prefix-");

    // Verify temp directories are created and unique
    expect(tempDir1).toBeTruthy();
    expect(tempDir2).toBeTruthy();
    expect(tempDir1).not.toBe(tempDir2);
    expect(tempDir2).toContain("custom-prefix-");
  });

  // Keep the old tests for backward compatibility
  it("should provide user data directories (backward compatibility)", async () => {
    // Import the module after setting up the DirectoryManager
    const directoriesModule = await import("../directories.js");

    // Debug: log the actual values
    console.log("testDirManager.getUserDataDir():", testDirManager.getUserDataDir());
    console.log("directories.sage:", directoriesModule.sage);

    // Verify that directories are provided by the DirectoryManager
    expect(directoriesModule.sage).toBe(testDirManager.getUserDataDir());
    expect(directoriesModule.config).toBe(
      path.join(testDirManager.getUserConfigDir(), "config.json")
    );
    expect(directoriesModule.threads).toBe(
      path.join(testDirManager.getUserDataDir(), "threads")
    );
  });

  it("should provide project-specific directories (backward compatibility)", async () => {
    // Import the module after setting up the DirectoryManager
    const directoriesModule = await import("../directories.js");

    // Test project directory functionality
    const projectDir = directoriesModule.getProjectSageDir();
    expect(projectDir).toBe(testDirManager.getProjectDir());

    // Test with custom CWD
    const customCwd = testDirManager.createSubDir("custom-project");
    const customProjectDir = directoriesModule.getProjectSageDir(customCwd);
    expect(customProjectDir).toBe(testDirManager.getProjectDir(customCwd));
  });

  it("should provide temporary directories (backward compatibility)", async () => {
    // Import the module after setting up the DirectoryManager
    const directoriesModule = await import("../directories.js");

    // Test temp directory functionality
    const tempDir1 = directoriesModule.getTempDir();
    const tempDir2 = directoriesModule.getTempDir("custom-prefix-");

    // Verify temp directories are created and unique
    expect(tempDir1).toBeTruthy();
    expect(tempDir2).toBeTruthy();
    expect(tempDir1).not.toBe(tempDir2);
    expect(tempDir2).toContain("custom-prefix-");
  });
});
