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
    expect(directories.getSageDir(testDirManager)).toBe(
      testDirManager.getUserDataDir()
    );
    expect(directories.getConfigPath(testDirManager)).toBe(
      path.join(testDirManager.getUserConfigDir(), "config.json")
    );
    expect(directories.getThreadsDir(testDirManager)).toBe(
      path.join(testDirManager.getUserDataDir(), "threads")
    );
  });

  it("should provide project-specific directories via dependency injection", () => {
    // Test project directory functionality
    const projectDir = directories.getProjectSageDir(testDirManager);
    expect(projectDir).toBe(testDirManager.getProjectDir());

    // Test with custom CWD
    const customCwd = testDirManager.createSubDir("custom-project");
    const customProjectDir = directories.getProjectSageDir(
      testDirManager,
      customCwd
    );
    expect(customProjectDir).toBe(testDirManager.getProjectDir(customCwd));
  });

  it("should provide temporary directories via dependency injection", () => {
    // Test temp directory functionality
    const tempDir1 = directories.getTempDir(testDirManager);
    const tempDir2 = directories.getTempDir(testDirManager, "custom-prefix-");

    // Verify temp directories are created and unique
    expect(tempDir1).toBeTruthy();
    expect(tempDir2).toBeTruthy();
    expect(tempDir1).not.toBe(tempDir2);
    expect(tempDir2).toContain("custom-prefix-");
  });
});
