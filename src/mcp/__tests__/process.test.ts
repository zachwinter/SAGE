import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { spawn } from "child_process";
import process from "process";
import {
  getRunningServers,
  isServerRunning,
  startServerProcess,
  stopServerProcess,
  restartServerProcess,
  cleanupStalePidFiles,
  getServerProcess
} from "../process/index.js";

// Mock dependencies
vi.mock("fs");
vi.mock("child_process");
vi.mock("@/utils/directories.js", () => ({
  sage: "/mock/sage/path"
}));

const mockFs = vi.mocked(fs);
const mockSpawn = vi.mocked(spawn);

// Mock process.kill
const originalProcessKill = process.kill;
let mockProcessKill: ReturnType<typeof vi.fn>;

describe("Process Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue("{}");
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);

    // Mock process.kill - returning true means no error thrown (process exists)
    mockProcessKill = vi.fn().mockReturnValue(true);
    process.kill = mockProcessKill as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.kill = originalProcessKill;
  });

  describe("isServerRunning", () => {
    it("should return false if no PID file exists", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = isServerRunning("test-server");
      expect(result).toBe(false);
    });

    it("should return true if process is running", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      mockProcessKill.mockReturnValue(true); // Process exists

      const result = isServerRunning("test-server");
      expect(result).toBe(true);
      expect(mockProcessKill).toHaveBeenCalledWith(1234, 0);
    });

    it("should return false and cleanup if process is not running", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      mockProcessKill.mockImplementation(() => {
        throw new Error("No such process");
      });

      const result = isServerRunning("test-server");
      expect(result).toBe(false);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );
    });

    it("should handle malformed PID file", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      const result = isServerRunning("test-server");
      expect(result).toBe(false);
    });
  });

  describe("getRunningServers", () => {
    it("should return list of running servers", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path === "/mock/sage/path/pids" || path.toString().includes(".pid");
      });

      mockFs.readdirSync.mockReturnValue([
        "server1.pid",
        "server2.pid",
        "other.txt"
      ]);

      mockFs.readFileSync.mockImplementation(path => {
        if (path.toString().includes("server1.pid")) {
          return JSON.stringify({
            pid: 1234,
            startTime: "2024-01-01T00:00:00.000Z",
            command: "node",
            args: ["server1.js"]
          });
        }
        if (path.toString().includes("server2.pid")) {
          return JSON.stringify({
            pid: 5678,
            startTime: "2024-01-01T01:00:00.000Z",
            command: "python3",
            args: ["server2.py"]
          });
        }
        return "{}";
      });

      mockProcessKill.mockReturnValue(true); // All processes exist

      const result = getRunningServers();

      expect(result).toHaveLength(2);
      expect(result[0].serverId).toBe("server1");
      expect(result[0].pid).toBe(1234);
      expect(result[1].serverId).toBe("server2");
      expect(result[1].pid).toBe(5678);
    });

    it("should filter out dead processes and cleanup", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path === "/mock/sage/path/pids" || path.toString().includes(".pid");
      });

      mockFs.readdirSync.mockReturnValue(["server1.pid", "server2.pid"]);

      mockFs.readFileSync.mockImplementation(path => {
        return JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        });
      });

      // First call succeeds (server1), second fails (server2)
      mockProcessKill.mockReturnValueOnce(true).mockImplementationOnce(() => {
        throw new Error("No such process");
      });

      const result = getRunningServers();

      expect(result).toHaveLength(1);
      expect(result[0].serverId).toBe("server1");
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/server2.pid"
      );
    });

    it("should return empty array if pids directory does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = getRunningServers();
      expect(result).toEqual([]);
    });
  });

  describe("startServerProcess", () => {
    it("should start a server process successfully", async () => {
      const mockChildProcess = {
        pid: 1234,
        on: vi.fn(),
        once: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      // Mock file existence checks
      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr.includes("test-server.pid")) return false; // Not already running
        if (pathStr === "/path/to/cwd/server.js") return true; // Script exists
        return false;
      });

      mockProcessKill.mockReturnValue(true); // Process starts successfully

      const startPromise = startServerProcess(
        "test-server",
        "node",
        ["server.js"],
        "/path/to/cwd"
      );

      // Simulate successful startup after timeout
      setTimeout(() => {
        // Process should exist when checked
        mockProcessKill.mockReturnValue(true);
      }, 50);

      const result = await startPromise;

      expect(result).toBe(mockChildProcess);
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        ["/path/to/cwd/server.js"],
        {
          cwd: "/path/to/cwd",
          stdio: "pipe",
          env: expect.any(Object)
        }
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid",
        expect.stringContaining('"pid": 1234')
      );
    });

    it("should throw error if server is already running", async () => {
      // Mock file existence checks
      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr.includes("test-server.pid")) return true; // PID file exists
        if (pathStr === "/path/to/cwd/server.js") return true; // Script exists
        return false;
      });

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );
      mockProcessKill.mockReturnValue(true); // Process exists

      await expect(
        startServerProcess("test-server", "node", ["server.js"], "/path/to/cwd")
      ).rejects.toThrow("Server test-server is already running");
    });

    it("should handle spawn failure", async () => {
      const mockChildProcess = {
        pid: undefined,
        on: vi.fn(),
        once: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      // Mock file existence checks
      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr.includes("test-server.pid")) return false; // Not already running
        if (pathStr === "/path/to/cwd/server.js") return true; // Script exists
        return false;
      });

      await expect(
        startServerProcess("test-server", "node", ["server.js"], "/path/to/cwd")
      ).rejects.toThrow("Failed to start process - no PID");
    });

    it("should handle process error", async () => {
      const mockChildProcess = {
        pid: 1234,
        on: vi.fn(),
        once: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      let pidFileExists = false;
      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr === "/path/to/cwd/server.js") return true; // Script exists
        if (pathStr.includes("test-server.pid")) return pidFileExists; // PID file only exists after writeFileSync
        return false;
      });

      // Mock writeFileSync to track when PID file is created
      mockFs.writeFileSync.mockImplementation((path, data) => {
        if (path.toString().includes("test-server.pid")) {
          pidFileExists = true;
        }
      });

      const startPromise = startServerProcess(
        "test-server",
        "node",
        ["server.js"],
        "/path/to/cwd"
      );

      // Trigger error event
      const onError = mockChildProcess.once.mock.calls.find(
        call => call[0] === "error"
      )?.[1];
      onError?.(new Error("Spawn failed"));

      await expect(startPromise).rejects.toThrow("Spawn failed");
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );
    });
  });

  describe("stopServerProcess", () => {
    it("should stop a running server gracefully", async () => {
      vi.useFakeTimers();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      let killCallCount = 0;
      mockProcessKill.mockImplementation((pid, signal) => {
        killCallCount++;
        if (killCallCount === 1) return true; // Initial check
        if (killCallCount === 2) return true; // SIGTERM call
        // After SIGTERM, process is dead
        throw new Error("No such process");
      });

      const stopPromise = stopServerProcess("test-server");

      // Fast-forward time to trigger the interval check
      vi.advanceTimersByTime(150);

      await stopPromise;

      expect(mockProcessKill).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );

      vi.useRealTimers();
    });

    it("should force kill if graceful shutdown fails", async () => {
      vi.useFakeTimers();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      // Process persists through SIGTERM, needs SIGKILL
      let sigkillSent = false;
      mockProcessKill.mockImplementation((pid, signal) => {
        if (signal === "SIGKILL") {
          sigkillSent = true;
          return true; // SIGKILL succeeds
        }
        if (signal === "SIGTERM") {
          return true; // SIGTERM succeeds but process doesn't die
        }
        // For isProcessRunning checks (signal 0)
        return !sigkillSent; // Process dies after SIGKILL
      });

      const stopPromise = stopServerProcess("test-server");

      // Fast-forward past the 5-second timeout
      await vi.advanceTimersByTimeAsync(5100);

      await stopPromise;

      expect(mockProcessKill).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(mockProcessKill).toHaveBeenCalledWith(1234, "SIGKILL");

      vi.useRealTimers();
    });

    it("should handle non-existent PID file", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(stopServerProcess("test-server")).resolves.toBeUndefined();
    });

    it("should handle already dead process", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      mockProcessKill.mockImplementation(() => {
        throw new Error("No such process");
      });

      await stopServerProcess("test-server");

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );
    });
  });

  describe("restartServerProcess", () => {
    it("should stop and start a server", async () => {
      vi.useFakeTimers();

      // --- Stateful mock setup for PID file lifecycle ---
      let pidFileExists = true;
      const oldPidData = JSON.stringify({
        pid: 1234,
        startTime: "2024-01-01T00:00:00.000Z",
        command: "node",
        args: ["server.js"]
      });
      let currentPidData = oldPidData;

      mockFs.existsSync.mockImplementation(path => {
        const pathStr = path.toString();
        if (pathStr === "/path/to/cwd/server.js") return true; // Script exists
        if (pathStr.includes("test-server.pid")) return pidFileExists;
        // Assume pids directory always exists for this test
        return pathStr.endsWith("/pids");
      });

      mockFs.readFileSync.mockImplementation(() => currentPidData);

      mockFs.unlinkSync.mockImplementation(path => {
        if (path.toString().includes("test-server.pid")) {
          pidFileExists = false;
        }
      });

      mockFs.writeFileSync.mockImplementation((path, data) => {
        if (path.toString().includes("test-server.pid")) {
          pidFileExists = true;
          currentPidData = data as string;
        }
      });
      // --- End stateful mock setup ---

      let oldProcessKilled = false;
      mockProcessKill.mockImplementation((pid, signal) => {
        if (pid === 1234) {
          // Old process
          if (oldProcessKilled) {
            throw new Error("No such process");
          }
          if (signal === "SIGTERM") {
            // Simulate process dying shortly after SIGTERM
            setTimeout(() => {
              oldProcessKilled = true;
            }, 50);
          }
          return true;
        }
        return pid === 5678; // Health checks for new process
      });

      // Mock start process
      const mockChildProcess = {
        pid: 5678,
        on: vi.fn(),
        once: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      const restartPromise = restartServerProcess(
        "test-server",
        "node",
        ["server.js"],
        "/path/to/cwd"
      );

      // Advance timers to allow async operations to complete
      await vi.advanceTimersByTimeAsync(1000);

      const result = await restartPromise;

      expect(result).toBe(mockChildProcess);
      expect(mockProcessKill).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        ["/path/to/cwd/server.js"],
        expect.any(Object)
      );
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid",
        expect.stringContaining('"pid": 5678')
      );

      vi.useRealTimers();
    });
  });

  describe("cleanupStalePidFiles", () => {
    it("should remove PID files for dead processes", () => {
      mockFs.existsSync.mockImplementation(path => {
        return path === "/mock/sage/path/pids" || path.toString().includes(".pid");
      });

      mockFs.readdirSync.mockReturnValue([
        "server1.pid",
        "server2.pid",
        "other.txt"
      ]);

      mockFs.readFileSync.mockImplementation(path => {
        return JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        });
      });

      // First process is alive, second is dead
      mockProcessKill.mockReturnValueOnce(true).mockImplementationOnce(() => {
        throw new Error("No such process");
      });

      const result = cleanupStalePidFiles();

      expect(result).toBe(1); // One file cleaned
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/server2.pid"
      );
      expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(
        "/mock/sage/path/pids/server1.pid"
      );
    });

    it("should return 0 if pids directory does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = cleanupStalePidFiles();
      expect(result).toBe(0);
    });
  });

  describe("getServerProcess", () => {
    it("should return process info for running server", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      mockProcessKill.mockReturnValue(true);

      const result = getServerProcess("test-server");

      expect(result).toEqual({
        serverId: "test-server",
        pid: 1234,
        startTime: new Date("2024-01-01T00:00:00.000Z"),
        command: "node",
        args: ["server.js"]
      });
    });

    it("should return null for non-existent server", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = getServerProcess("test-server");
      expect(result).toBeNull();
    });

    it("should return null and cleanup for dead process", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 1234,
          startTime: "2024-01-01T00:00:00.000Z",
          command: "node",
          args: ["server.js"]
        })
      );

      mockProcessKill.mockImplementation(() => {
        throw new Error("No such process");
      });

      const result = getServerProcess("test-server");

      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/mock/sage/path/pids/test-server.pid"
      );
    });
  });
});
