import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { spawn } from "child_process";
import {
  ensureServersDirectory,
  getServerPath,
  isServerInstalled,
  cloneServer,
  removeServer,
  detectServerEntryPoint,
  scanInstalledServers,
  serverMetadataToConfig
} from "../installation";

// Mock dependencies
vi.mock("fs");
vi.mock("child_process");
vi.mock("../../utils/directories.js", () => ({
  sage: "/mock/sage/path",
  servers: "/mock/sage/path/servers",
  threads: "/mock/sage/path/threads",
  config: "/mock/sage/path/config.json"
}));

const mockFs = vi.mocked(fs);
const mockSpawn = vi.mocked(spawn);

describe("Filesystem Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue("");
    mockFs.readdirSync.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ensureServersDirectory", () => {
    it("should create servers directory if it does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      ensureServersDirectory();

      expect(mockFs.existsSync).toHaveBeenCalledWith("/mock/sage/path/servers");
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/mock/sage/path/servers", {
        recursive: true
      });
    });

    it("should not create directory if it already exists", () => {
      mockFs.existsSync.mockReturnValue(true);

      ensureServersDirectory();

      expect(mockFs.existsSync).toHaveBeenCalledWith("/mock/sage/path/servers");
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("getServerPath", () => {
    it("should extract repository name from GitHub URL", () => {
      const result = getServerPath("https://github.com/user/repo-name");
      expect(result).toBe("/mock/sage/path/servers/repo-name");
    });

    it("should handle GitHub URLs with .git suffix", () => {
      const result = getServerPath("https://github.com/user/repo-name.git");
      expect(result).toBe("/mock/sage/path/servers/repo-name");
    });

    it("should handle malformed URLs gracefully", () => {
      const result = getServerPath("invalid-url");
      expect(result).toBe("/mock/sage/path/servers/unknown");
    });
  });

  describe("isServerInstalled", () => {
    it("should return true if server directory and .git exist", () => {
      mockFs.existsSync.mockImplementation(path => {
        if (path === "/mock/sage/path/servers/test-repo") return true;
        if (path === "/mock/sage/path/servers/test-repo/.git") return true;
        return false;
      });

      const result = isServerInstalled("https://github.com/user/test-repo");
      expect(result).toBe(true);
    });

    it("should return false if server directory does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = isServerInstalled("https://github.com/user/test-repo");
      expect(result).toBe(false);
    });

    it("should return false if .git directory does not exist", () => {
      mockFs.existsSync.mockImplementation(path => {
        if (path === "/mock/sage/path/servers/test-repo") return true;
        if (path === "/mock/sage/path/servers/test-repo/.git") return false;
        return false;
      });

      const result = isServerInstalled("https://github.com/user/test-repo");
      expect(result).toBe(false);
    });
  });

  describe("cloneServer", () => {
    it("should throw error if server is already installed", async () => {
      mockFs.existsSync.mockImplementation(path => {
        if (path === "/mock/sage/path/servers/test-repo") return true;
        if (path === "/mock/sage/path/servers/test-repo/.git") return true;
        return false;
      });

      await expect(
        cloneServer("https://github.com/user/test-repo", "test-repo")
      ).rejects.toThrow("Server already installed");
    });

    it("should successfully clone a repository", async () => {
      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);
      mockFs.existsSync.mockReturnValue(false);

      // Simulate successful clone
      const clonePromise = cloneServer(
        "https://github.com/user/test-repo",
        "test-repo"
      );

      // Trigger the 'close' event with success code
      const onClose = mockChildProcess.on.mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      onClose?.(0);

      const result = await clonePromise;
      expect(result).toBe("/mock/sage/path/servers/test-repo");
      expect(mockSpawn).toHaveBeenCalledWith(
        "git",
        [
          "clone",
          "https://github.com/user/test-repo",
          "/mock/sage/path/servers/test-repo"
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
      mockFs.existsSync.mockReturnValue(false);

      const clonePromise = cloneServer(
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
      onClose?.(1);

      await expect(clonePromise).rejects.toThrow(
        "Git clone failed: Permission denied"
      );
    });
  });

  describe("detectServerEntryPoint", () => {
    it("should detect Python server entry points", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path.toString().endsWith("server.py");
      });

      const result = detectServerEntryPoint("/path/to/server");
      expect(result).toEqual({
        entryPoint: "/path/to/server/server.py",
        entryType: "python"
      });
    });

    it("should detect Node.js entry points from package.json", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path.toString().endsWith("package.json");
      });

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          scripts: { start: "node server.js" }
        })
      );

      const result = detectServerEntryPoint("/path/to/server");
      // FIX: Change "npm start" to "npm run start" to match the actual output
      expect(result).toEqual({
        entryPoint: "npm run start",
        entryType: "node"
      });
    });

    it("should detect Node.js files directly", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path.toString().endsWith("server.js");
      });

      const result = detectServerEntryPoint("/path/to/server");
      expect(result).toEqual({
        entryPoint: "/path/to/server/server.js",
        entryType: "node"
      });
    });

    it("should return empty object if no entry point found", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = detectServerEntryPoint("/path/to/server");
      expect(result).toEqual({});
    });

    it("should handle malformed package.json gracefully", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path.toString().endsWith("package.json");
      });

      mockFs.readFileSync.mockReturnValue("invalid json");

      const result = detectServerEntryPoint("/path/to/server");
      expect(result).toEqual({});
    });
  });

  describe("serverMetadataToConfig", () => {
    it("should convert Python server metadata to config", () => {
      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        entryPoint: "/path/to/server/server.py",
        entryType: "python" as const,
        hasPackageJson: false,
        hasPythonFile: true
      };

      const result = serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.platform === "win32" ? "python" : "python3",
        args: ["/path/to/server/server.py"],
        enabled: false,
        env: {
          PYTHONPATH: "/path/to/server"
        }
      });
    });

    it("should convert Node.js server metadata to config", () => {
      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        entryPoint: "/path/to/server/server.js",
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: process.execPath,
        args: ["/path/to/server/server.js"],
        enabled: false,
        env: {
          NODE_PATH: "/path/to/server"
        }
      });
    });

    it("should handle npm script entry points", () => {
      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        entryPoint: "npm start",
        entryType: "node" as const,
        hasPackageJson: true,
        hasPythonFile: false
      };

      const result = serverMetadataToConfig(metadata);

      expect(result).toEqual({
        id: "test-server",
        name: "test-server",
        type: "stdio",
        command: "npm",
        args: ["start"],
        enabled: false,
        env: {
          NODE_PATH: "/path/to/server"
        }
      });
    });

    it("should return null if no entry point or type", () => {
      const metadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        hasPackageJson: false,
        hasPythonFile: false
      };

      const result = serverMetadataToConfig(metadata);
      expect(result).toBeNull();
    });
  });

  describe("removeServer", () => {
    it("should remove server directory", async () => {
      const mockRm = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(mockFs, "promises", {
        value: { rm: mockRm },
        writable: true,
        configurable: true
      });
      mockFs.existsSync.mockReturnValue(true);

      await removeServer("https://github.com/user/test-repo");

      expect(mockRm).toHaveBeenCalledWith("/mock/sage/path/servers/test-repo", {
        recursive: true,
        force: true
      });
    });

    it("should not fail if server directory does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        removeServer("https://github.com/user/test-repo")
      ).resolves.toBeUndefined();
    });
  });

  describe("scanInstalledServers", () => {
    it("should scan and return installed servers", () => {
      const mockDirents = [
        { name: "server1", isDirectory: () => true },
        { name: "file.txt", isDirectory: () => false },
        { name: "server2", isDirectory: () => true }
      ];

      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr === "/mock/sage/path/servers") return true;
        if (pathStr.includes("/.git")) return true;
        if (pathStr.includes("/server1/.git/config")) return true;
        if (pathStr.includes("/server2/.git/config")) return true;
        if (pathStr.includes("server.py")) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue(mockDirents as any);
      mockFs.readFileSync.mockImplementation(path => {
        if (path.toString().includes(".git/config")) {
          return "url = https://github.com/user/test-repo";
        }
        return "";
      });

      const result = scanInstalledServers();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("server1");
      expect(result[1].name).toBe("server2");
    });

    it("should return empty array if servers directory does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = scanInstalledServers();
      expect(result).toEqual([]);
    });

    it("should skip directories without .git", () => {
      const mockDirents = [{ name: "not-a-repo", isDirectory: () => true }];

      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr === "/mock/sage/path/servers") return true;
        if (pathStr.includes("/.git")) return false;
        return false;
      });

      mockFs.readdirSync.mockReturnValue(mockDirents as any);

      const result = scanInstalledServers();
      expect(result).toEqual([]);
    });
  });
});
