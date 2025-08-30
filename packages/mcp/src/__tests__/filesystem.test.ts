import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TestDirectoryManager } from "@sage/utils";
import { spawn } from "child_process";
import path from "path";
import * as filesystem from "../installation/filesystem.js";
// import * as oldFilesystem from "../installation/filesystem.js"; // No longer needed as we've replaced the original with the refactored version

// Mock child_process.spawn for git operations
vi.mock("child_process");

const mockSpawn = vi.mocked(spawn);

describe("Filesystem Utilities (Refactored)", () => {
  let testDirManager: TestDirectoryManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test directory manager
    testDirManager = new TestDirectoryManager();
  });

  afterEach(async () => {
    await testDirManager.cleanup();
    vi.restoreAllMocks();
  });

  describe("ensureServersDirectory", () => {
    it("should create servers directory if it does not exist", () => {
      // Verify it doesn't exist initially (since we haven't called the function)
      filesystem.ensureServersDirectory(testDirManager);

      // The function should have created it - we can verify by calling it again
      expect(() => filesystem.ensureServersDirectory(testDirManager)).not.toThrow();
    });
  });

  describe("getServerPath", () => {
    it("should extract repository name from GitHub URL", () => {
      const result = filesystem.getServerPath(
        testDirManager,
        "https://github.com/user/repo-name"
      );
      expect(result).toContain("repo-name");
      expect(result).toContain("servers");
    });

    it("should handle GitHub URLs with .git suffix", () => {
      const result = filesystem.getServerPath(
        testDirManager,
        "https://github.com/user/repo-name.git"
      );
      expect(result).toContain("repo-name");
    });

    it("should handle malformed URLs gracefully", () => {
      const result = filesystem.getServerPath(testDirManager, "invalid-url");
      expect(result).toContain("unknown");
    });
  });

  describe("isServerInstalled", () => {
    it("should return true if server directory and .git exist", () => {
      // Create server directory structure in our test filesystem
      const repoName = "test-repo";
      const serverDir = testDirManager.createSubDir(`data/servers/${repoName}`);
      testDirManager.createSubDir(`data/servers/${repoName}/.git`);

      const result = filesystem.isServerInstalled(
        testDirManager,
        "https://github.com/user/test-repo"
      );
      expect(result).toBe(true);
    });

    it("should return false if server directory does not exist", () => {
      const result = filesystem.isServerInstalled(
        testDirManager,
        "https://github.com/user/non-existent"
      );
      expect(result).toBe(false);
    });

    it("should return false if .git directory does not exist", () => {
      // Create server directory but not .git
      testDirManager.createSubDir("servers/test-repo");

      const result = filesystem.isServerInstalled(
        testDirManager,
        "https://github.com/user/test-repo"
      );
      expect(result).toBe(false);
    });
  });

  describe("cloneServer", () => {
    it("should throw error if server is already installed", async () => {
      // Pre-create server with .git directory
      testDirManager.createSubDir("data/servers/test-repo/.git");

      await expect(
        filesystem.cloneServer(
          testDirManager,
          "https://github.com/user/test-repo",
          "test-repo"
        )
      ).rejects.toThrow("Server already installed");
    });

    it("should successfully clone a repository", async () => {
      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const clonePromise = filesystem.cloneServer(
        testDirManager,
        "https://github.com/user/test-repo",
        "test-repo"
      );

      // Simulate successful clone by triggering the 'close' event
      const onClose = mockChildProcess.on.mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      onClose?.(0); // Success exit code

      const result = await clonePromise;
      expect(result).toContain("test-repo");
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        [
          "clone",
          "https://github.com/user/test-repo",
          expect.stringContaining("test-repo")
        ],
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    });

    it("should handle git clone failure", async () => {
      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const clonePromise = filesystem.cloneServer(
        testDirManager,
        "https://github.com/user/test-repo",
        "test-repo"
      );

      // Simulate stderr output
      const onStderr = mockChildProcess.stderr.on.mock.calls.find(
        call => call[0] === "data"
      )?.[1];
      onStderr?.("Permission denied");

      // Trigger the 'close' event with error code
      const onClose = mockChildProcess.on.mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      onClose?.(1); // Error exit code

      await expect(clonePromise).rejects.toThrow(
        "Git clone failed: Permission denied"
      );
    });
  });

  describe("detectServerEntryPoint", () => {
    it("should detect Python server entry points", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a Python server file
      const fs = require("fs");
      const serverPyPath = path.join(serverDir, "server.py");
      fs.writeFileSync(serverPyPath, "# Python server");

      const result = filesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: serverPyPath,
        entryType: "python"
      });
    });

    it("should detect Node.js entry points from package.json", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a package.json with start script
      const fs = require("fs");
      const packageJsonPath = path.join(serverDir, "package.json");
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify({
          scripts: { start: "node server.js" }
        })
      );

      const result = filesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: "npm run start",
        entryType: "node"
      });
    });

    it("should detect Node.js files directly", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a Node.js server file
      const fs = require("fs");
      const serverJsPath = path.join(serverDir, "server.js");
      fs.writeFileSync(serverJsPath, "// Node.js server");

      const result = filesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: serverJsPath,
        entryType: "node"
      });
    });

    it("should return empty object if no entry point found", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const result = filesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({});
    });

    it("should handle malformed package.json gracefully", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write malformed JSON
      const fs = require("fs");
      const packageJsonPath = path.join(serverDir, "package.json");
      fs.writeFileSync(packageJsonPath, "invalid json");

      const result = filesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({});
    });
  });

  describe("serverMetadataToConfig", () => {
    it("should convert Python server metadata to config", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");
      const entryPoint = path.join(serverDir, "server.py");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: entryPoint,
        entryType: "python" as const,
        hasPackageJson: false,
        hasPythonFile: true
      };

      const result = filesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.platform === "win32" ? "python" : "python3",
        args: [entryPoint],
        enabled: false,
        env: {
          PYTHONPATH: serverDir
        }
      });
    });

    it("should convert Node.js server metadata to config", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");
      const entryPoint = path.join(serverDir, "server.js");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: entryPoint,
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = filesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.execPath,
        args: [entryPoint],
        enabled: false,
        env: {
          NODE_PATH: serverDir
        }
      });
    });

    it("should handle npm script entry points", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: "npm start",
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = filesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: "npm",
        args: ["start"],
        enabled: false,
        env: {
          NODE_PATH: serverDir
        }
      });
    });

    it("should return null if no entry point or type", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        hasPackageJson: false,
        hasPythonFile: false
      };

      const result = filesystem.serverMetadataToConfig(metadata);
      expect(result).toBeNull();
    });
  });

  describe("removeServer", () => {
    it("should remove server directory", async () => {
      // Create a server directory with files
      const serverDir = testDirManager.createSubDir("data/servers/test-repo");

      // Write a file to verify it gets removed
      const fs = require("fs");
      fs.writeFileSync(path.join(serverDir, "server.py"), "# Test server");

      // Verify it exists
      expect(fs.existsSync(serverDir)).toBe(true);

      await filesystem.removeServer(
        testDirManager,
        "https://github.com/user/test-repo"
      );

      // Verify it's been removed
      expect(fs.existsSync(serverDir)).toBe(false);
    });

    it("should not fail if server directory does not exist", async () => {
      await expect(
        filesystem.removeServer(
          testDirManager,
          "https://github.com/user/non-existent"
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("scanInstalledServers", () => {
    it("should scan and return installed servers", () => {
      const fs = require("fs");

      // Create test server directories with git config
      const server1Dir = testDirManager.createSubDir("data/servers/server1");
      const server1GitDir = testDirManager.createSubDir("data/servers/server1/.git");
      fs.writeFileSync(
        path.join(server1GitDir, "config"),
        "url = https://github.com/user/server1"
      );
      fs.writeFileSync(path.join(server1Dir, "server.py"), "# Python server");

      const server2Dir = testDirManager.createSubDir("data/servers/server2");
      const server2GitDir = testDirManager.createSubDir("data/servers/server2/.git");
      fs.writeFileSync(
        path.join(server2GitDir, "config"),
        "url = https://github.com/user/server2"
      );
      fs.writeFileSync(path.join(server2Dir, "server.js"), "// Node server");

      const result = filesystem.scanInstalledServers(testDirManager);

      expect(result).toHaveLength(2);

      const serverNames = result.map(s => s.name).sort();
      expect(serverNames).toEqual(["server1", "server2"]);

      const server1 = result.find(s => s.name === "server1")!;
      expect(server1.github).toBe("https://github.com/user/server1");
      expect(server1.entryType).toBe("python");

      const server2 = result.find(s => s.name === "server2")!;
      expect(server2.github).toBe("https://github.com/user/server2");
      expect(server2.entryType).toBe("node");
    });

    it("should return empty array if servers directory does not exist", () => {
      // Don't create any servers - the result should be empty
      const result = filesystem.scanInstalledServers(testDirManager);
      expect(result).toEqual([]);
    });

    it("should skip directories without .git", () => {
      // Create a directory without .git
      testDirManager.createSubDir("servers/not-a-repo");
      const fs = require("fs");
      fs.writeFileSync(
        path.join(
          testDirManager.getBaseTempDir(),
          "servers/not-a-repo/some-file.txt"
        ),
        "content"
      );

      const result = filesystem.scanInstalledServers(testDirManager);
      expect(result).toEqual([]);
    });

    it("should handle git config parsing errors gracefully", () => {
      const fs = require("fs");

      // Create a server with invalid git config
      const brokenDir = testDirManager.createSubDir("data/servers/broken-repo");
      const brokenGitDir = testDirManager.createSubDir(
        "data/servers/broken-repo/.git"
      );
      fs.writeFileSync(path.join(brokenGitDir, "config"), "invalid config");

      const result = filesystem.scanInstalledServers(testDirManager);

      // Should return the server but with empty github URL
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("broken-repo");
      expect(result[0].github).toBe("");
    });
  });
});

// Keep the old tests for backward compatibility
describe("Filesystem Utilities (Legacy)", () => {
  let testDirManager: TestDirectoryManager;
  let mockServersDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test directory manager
    testDirManager = new TestDirectoryManager();

    // Create a mock servers directory structure
    mockServersDir = testDirManager.createSubDir("data/servers");

    // Mock the directories module to return our test directory
    vi.doMock("../utils/directories", () => ({
      sage: testDirManager.getUserDataDir()
    }));
  });

  afterEach(async () => {
    await testDirManager.cleanup();
    vi.restoreAllMocks();
  });

  describe("ensureServersDirectory", () => {
    it("should create servers directory if it does not exist", () => {
      // Remove the servers directory
      const serversPath = path.join(testDirManager.getUserDataDir(), "servers");

      // Verify it doesn't exist initially (since we haven't called the function)
      oldFilesystem.ensureServersDirectory();

      // The function should have created it - we can verify by calling it again
      expect(() => oldFilesystem.ensureServersDirectory()).not.toThrow();
    });
  });

  describe("getServerPath", () => {
    it("should extract repository name from GitHub URL", () => {
      const result = oldFilesystem.getServerPath(
        "https://github.com/user/repo-name"
      );
      expect(result).toContain("repo-name");
      expect(result).toContain("servers");
    });

    it("should handle GitHub URLs with .git suffix", () => {
      const result = oldFilesystem.getServerPath(
        "https://github.com/user/repo-name.git"
      );
      expect(result).toContain("repo-name");
    });

    it("should handle malformed URLs gracefully", () => {
      const result = oldFilesystem.getServerPath("invalid-url");
      expect(result).toContain("unknown");
    });
  });

  describe("isServerInstalled", () => {
    it("should return true if server directory and .git exist", () => {
      // Create server directory structure in our test filesystem
      const repoName = "test-repo";
      const serverDir = testDirManager.createSubDir(`data/servers/${repoName}`);
      testDirManager.createSubDir(`data/servers/${repoName}/.git`);

      const result = oldFilesystem.isServerInstalled(
        "https://github.com/user/test-repo"
      );
      expect(result).toBe(true);
    });

    it("should return false if server directory does not exist", () => {
      const result = oldFilesystem.isServerInstalled(
        "https://github.com/user/non-existent"
      );
      expect(result).toBe(false);
    });

    it("should return false if .git directory does not exist", () => {
      // Create server directory but not .git
      testDirManager.createSubDir("servers/test-repo");

      const result = oldFilesystem.isServerInstalled(
        "https://github.com/user/test-repo"
      );
      expect(result).toBe(false);
    });
  });

  describe("cloneServer", () => {
    it("should throw error if server is already installed", async () => {
      // Pre-create server with .git directory
      testDirManager.createSubDir("data/servers/test-repo/.git");

      await expect(
        oldFilesystem.cloneServer("https://github.com/user/test-repo", "test-repo")
      ).rejects.toThrow("Server already installed");
    });

    it("should successfully clone a repository", async () => {
      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const clonePromise = oldFilesystem.cloneServer(
        "https://github.com/user/test-repo",
        "test-repo"
      );

      // Simulate successful clone by triggering the 'close' event
      const onClose = mockChildProcess.on.mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      onClose?.(0); // Success exit code

      const result = await clonePromise;
      expect(result).toContain("test-repo");
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        [
          "clone",
          "https://github.com/user/test-repo",
          expect.stringContaining("test-repo")
        ],
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    });

    it("should handle git clone failure", async () => {
      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const clonePromise = oldFilesystem.cloneServer(
        "https://github.com/user/test-repo",
        "test-repo"
      );

      // Simulate stderr output
      const onStderr = mockChildProcess.stderr.on.mock.calls.find(
        call => call[0] === "data"
      )?.[1];
      onStderr?.("Permission denied");

      // Trigger the 'close' event with error code
      const onClose = mockChildProcess.on.mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      onClose?.(1); // Error exit code

      await expect(clonePromise).rejects.toThrow(
        "Git clone failed: Permission denied"
      );
    });
  });

  describe("detectServerEntryPoint", () => {
    it("should detect Python server entry points", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a Python server file
      const fs = require("fs");
      const serverPyPath = path.join(serverDir, "server.py");
      fs.writeFileSync(serverPyPath, "# Python server");

      const result = oldFilesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: serverPyPath,
        entryType: "python"
      });
    });

    it("should detect Node.js entry points from package.json", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a package.json with start script
      const fs = require("fs");
      const packageJsonPath = path.join(serverDir, "package.json");
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify({
          scripts: { start: "node server.js" }
        })
      );

      const result = oldFilesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: "npm run start",
        entryType: "node"
      });
    });

    it("should detect Node.js files directly", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write a Node.js server file
      const fs = require("fs");
      const serverJsPath = path.join(serverDir, "server.js");
      fs.writeFileSync(serverJsPath, "// Node.js server");

      const result = oldFilesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({
        entryPoint: serverJsPath,
        entryType: "node"
      });
    });

    it("should return empty object if no entry point found", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const result = oldFilesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({});
    });

    it("should handle malformed package.json gracefully", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      // Write malformed JSON
      const fs = require("fs");
      const packageJsonPath = path.join(serverDir, "package.json");
      fs.writeFileSync(packageJsonPath, "invalid json");

      const result = oldFilesystem.detectServerEntryPoint(serverDir);
      expect(result).toEqual({});
    });
  });

  describe("serverMetadataToConfig", () => {
    it("should convert Python server metadata to config", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");
      const entryPoint = path.join(serverDir, "server.py");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: entryPoint,
        entryType: "python" as const,
        hasPackageJson: false,
        hasPythonFile: true
      };

      const result = oldFilesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.platform === "win32" ? "python" : "python3",
        args: [entryPoint],
        enabled: false,
        env: {
          PYTHONPATH: serverDir
        }
      });
    });

    it("should convert Node.js server metadata to config", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");
      const entryPoint = path.join(serverDir, "server.js");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: entryPoint,
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = oldFilesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.execPath,
        args: [entryPoint],
        enabled: false,
        env: {
          NODE_PATH: serverDir
        }
      });
    });

    it("should handle npm script entry points", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        entryPoint: "npm start",
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = oldFilesystem.serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: "npm",
        args: ["start"],
        enabled: false,
        env: {
          NODE_PATH: serverDir
        }
      });
    });

    it("should return null if no entry point or type", () => {
      const serverDir = testDirManager.createSubDir("servers/test-server");

      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: serverDir,
        hasPackageJson: false,
        hasPythonFile: false
      };

      const result = oldFilesystem.serverMetadataToConfig(metadata);
      expect(result).toBeNull();
    });
  });

  describe("removeServer", () => {
    it("should remove server directory", async () => {
      // Create a server directory with files
      const serverDir = testDirManager.createSubDir("data/servers/test-repo");

      // Write a file to verify it gets removed
      const fs = require("fs");
      fs.writeFileSync(path.join(serverDir, "server.py"), "# Test server");

      // Verify it exists
      expect(fs.existsSync(serverDir)).toBe(true);

      await oldFilesystem.removeServer("https://github.com/user/test-repo");

      // Verify it's been removed
      expect(fs.existsSync(serverDir)).toBe(false);
    });

    it("should not fail if server directory does not exist", async () => {
      await expect(
        oldFilesystem.removeServer("https://github.com/user/non-existent")
      ).resolves.toBeUndefined();
    });
  });

  describe("scanInstalledServers", () => {
    it("should scan and return installed servers", () => {
      const fs = require("fs");

      // Create test server directories with git config
      const server1Dir = testDirManager.createSubDir("data/servers/server1");
      const server1GitDir = testDirManager.createSubDir("data/servers/server1/.git");
      fs.writeFileSync(
        path.join(server1GitDir, "config"),
        "url = https://github.com/user/server1"
      );
      fs.writeFileSync(path.join(server1Dir, "server.py"), "# Python server");

      const server2Dir = testDirManager.createSubDir("data/servers/server2");
      const server2GitDir = testDirManager.createSubDir("data/servers/server2/.git");
      fs.writeFileSync(
        path.join(server2GitDir, "config"),
        "url = https://github.com/user/server2"
      );
      fs.writeFileSync(path.join(server2Dir, "server.js"), "// Node server");

      const result = oldFilesystem.scanInstalledServers();

      expect(result).toHaveLength(2);

      const serverNames = result.map(s => s.name).sort();
      expect(serverNames).toEqual(["server1", "server2"]);

      const server1 = result.find(s => s.name === "server1")!;
      expect(server1.github).toBe("https://github.com/user/server1");
      expect(server1.entryType).toBe("python");

      const server2 = result.find(s => s.name === "server2")!;
      expect(server2.github).toBe("https://github.com/user/server2");
      expect(server2.entryType).toBe("node");
    });

    it("should return empty array if servers directory does not exist", () => {
      // Don't create any servers - the result should be empty
      const result = oldFilesystem.scanInstalledServers();
      expect(result).toEqual([]);
    });

    it("should skip directories without .git", () => {
      // Create a directory without .git
      testDirManager.createSubDir("servers/not-a-repo");
      const fs = require("fs");
      fs.writeFileSync(
        path.join(
          testDirManager.getBaseTempDir(),
          "servers/not-a-repo/some-file.txt"
        ),
        "content"
      );

      const result = oldFilesystem.scanInstalledServers();
      expect(result).toEqual([]);
    });

    it("should handle git config parsing errors gracefully", () => {
      const fs = require("fs");

      // Create a server with invalid git config
      const brokenDir = testDirManager.createSubDir("data/servers/broken-repo");
      const brokenGitDir = testDirManager.createSubDir(
        "data/servers/broken-repo/.git"
      );
      fs.writeFileSync(path.join(brokenGitDir, "config"), "invalid config");

      const result = oldFilesystem.scanInstalledServers();

      // Should return the server but with empty github URL
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("broken-repo");
      expect(result[0].github).toBe("");
    });
  });
});
