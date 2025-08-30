import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  startServerProcess,
  stopServerProcess,
  getRunningServers,
  isServerRunning
} from "../../process/manager";
import { ChildProcess } from "child_process";
import { TestDirectoryManager } from "@sage/utils";

// Create a directory manager for testing
const testDirManager = new TestDirectoryManager();

describe("Process Integration", () => {
  let tempDir: string;
  let scriptPath: string;
  let serverId = "test-process-server";
  let childProcess: ChildProcess | null = null;

  beforeAll(() => {
    tempDir = createTempDir();
    scriptPath = path.join(tempDir, "test-server.js");
    // A simple script that stays alive AND signals readiness
    fs.writeFileSync(
      scriptPath,
      `
      console.error('MCP server ready'); // <-- THE FIX IS HERE
      setInterval(() => { console.log('ping'); }, 1000);
      `
    );
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Ensure the process is stopped after each test
    if (childProcess && childProcess.pid && !childProcess.killed) {
      // Await stopServerProcess which now handles cleanup.
      await stopServerProcess(testDirManager, serverId);
      childProcess = null;
    }
    cleanupStalePidFiles(testDirManager);
  });

  it("should start a server process and create a PID file", async () => {
    childProcess = await startServerProcess(
      testDirManager,
      serverId,
      "node",
      [scriptPath],
      tempDir // Use tempDir as cwd for consistency
    );
    expect(childProcess.pid).toBeDefined();

    const isRunning = isServerRunning(testDirManager, serverId);
    expect(isRunning).toBe(true);

    const serverProcess = getServerProcess(testDirManager, serverId);
    expect(serverProcess).not.toBeNull();
    expect(serverProcess?.pid).toBe(childProcess.pid);
  });

  it("should stop a running server process", async () => {
    childProcess = await startServerProcess(
      testDirManager,
      serverId,
      "node",
      [scriptPath],
      tempDir // Use tempDir as cwd
    );
    expect(isServerRunning(testDirManager, serverId)).toBe(true);

    await stopServerProcess(testDirManager, serverId);
    expect(isServerRunning(testDirManager, serverId)).toBe(false);
  });

  it("should not find a process that is not running", () => {
    expect(isServerRunning(testDirManager, "non-existent-server")).toBe(false);
  });

  it("should clean up stale PID files", async () => {
    // Manually create a stale PID file in the test directory
    const staleServerId = "stale-server";
    const pidDir = path.join(testDirManager.getUserDataDir(), "pids");
    fs.mkdirSync(pidDir, { recursive: true });
    const pidFilePath = path.join(pidDir, `${staleServerId}.pid`);
    fs.writeFileSync(
      pidFilePath,
      JSON.stringify({
        pid: 99999,
        startTime: new Date().toISOString(),
        command: "fake",
        args: []
      })
    );

    cleanupStalePidFiles(testDirManager);

    expect(fs.existsSync(pidFilePath)).toBe(false);
  });
});
