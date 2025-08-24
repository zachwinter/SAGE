import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  startServerProcess,
  stopServerProcess,
  isServerRunning,
  getServerProcess,
  cleanupStalePidFiles,
} from "../../process/manager";
import { ChildProcess } from "child_process";

const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-process-test-"));
};

describe("Process Integration", () => {
  let tempDir: string;
  let scriptPath: string;
  let serverId = "test-process-server";
  let childProcess: ChildProcess | null = null;

  beforeAll(() => {
    tempDir = createTempDir();
    scriptPath = path.join(tempDir, "test-server.js");
    // A simple script that stays alive
    fs.writeFileSync(scriptPath, "setInterval(() => { console.log('ping'); }, 1000);");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Ensure the process is stopped after each test
    if (childProcess && !childProcess.killed) {
      await stopServerProcess(serverId);
    }
    cleanupStalePidFiles();
  });

  it("should start a server process and create a PID file", async () => {
    childProcess = await startServerProcess(serverId, "node", [scriptPath], process.cwd());
    expect(childProcess.pid).toBeDefined();

    const isRunning = isServerRunning(serverId);
    expect(isRunning).toBe(true);

    const serverProcess = getServerProcess(serverId);
    expect(serverProcess).not.toBeNull();
    expect(serverProcess?.pid).toBe(childProcess.pid);
  });

  it("should stop a running server process", async () => {
    childProcess = await startServerProcess(serverId, "node", [scriptPath], process.cwd());
    expect(isServerRunning(serverId)).toBe(true);

    await stopServerProcess(serverId);
    expect(isServerRunning(serverId)).toBe(false);
  });

  it("should not find a process that is not running", () => {
    expect(isServerRunning("non-existent-server")).toBe(false);
  });

  it("should clean up stale PID files", async () => {
    // Manually create a stale PID file
    const staleServerId = "stale-server";
    const pidFilePath = path.join(os.homedir(), ".sage", "pids", `${staleServerId}.pid`);
    fs.writeFileSync(pidFilePath, JSON.stringify({ pid: 99999, startTime: new Date().toISOString(), command: "fake", args: [] }));

    cleanupStalePidFiles();

    expect(fs.existsSync(pidFilePath)).toBe(false);
  });
});