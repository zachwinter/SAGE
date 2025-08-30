import { Logger } from "@sage/utils";
import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getSageDirDI } from "../utils/directories.js";

const logger = new Logger("MCP Process Manager");

/**
 * Get the PIDs directory path for a given DirectoryManager
 */
function getPidsDir(directoryManager: any): string {
  return path.join(getSageDirDI(directoryManager), "pids");
}

/**
 * Ensure the PIDs directory exists
 */
function ensurePidsDirectory(directoryManager: any): void {
  const pidsDir = getPidsDir(directoryManager);
  if (!fs.existsSync(pidsDir)) {
    fs.mkdirSync(pidsDir, { recursive: true });
  }
}

/**
 * Get the PID file path for a server
 */
function getPidFilePath(directoryManager: any, serverId: string): string {
  const pidsDir = getPidsDir(directoryManager);
  return path.join(pidsDir, `${serverId}.pid`);
}

/**
 * Write PID file for a server
 */
function writePidFile(
  directoryManager: any,
  serverId: string,
  pid: number,
  command: string,
  args: string[]
): void {
  ensurePidsDirectory(directoryManager);

  const pidData = {
    pid,
    startTime: new Date().toISOString(),
    command,
    args
  };

  const pidFilePath = getPidFilePath(directoryManager, serverId);
  fs.writeFileSync(pidFilePath, JSON.stringify(pidData, null, 2));
}

/**
 * Read PID file for a server
 */
function readPidFile(
  directoryManager: any,
  serverId: string
): { pid: number; startTime: string; command: string; args: string[] } | null {
  const pidFilePath = getPidFilePath(directoryManager, serverId);

  if (!fs.existsSync(pidFilePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(pidFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    logger.warn(`Failed to read PID file for ${serverId}:`, error as Error);
    return null;
  }
}

/**
 * Remove PID file for a server
 */
function removePidFile(directoryManager: any, serverId: string): void {
  const pidFilePath = getPidFilePath(directoryManager, serverId);

  if (fs.existsSync(pidFilePath)) {
    fs.unlinkSync(pidFilePath);
  }
}

/**
 * Check if a process is actually running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // On Unix-like systems, sending signal 0 checks if process exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all running server processes from PID files
 */
export function getRunningServers(directoryManager: any): ServerProcess[] {
  ensurePidsDirectory(directoryManager);

  const processes: ServerProcess[] = [];

  const pidsDir = getPidsDir(directoryManager);
  if (!fs.existsSync(pidsDir)) {
    return processes;
  }

  const pidFiles = fs.readdirSync(pidsDir).filter(file => file.endsWith(".pid"));

  for (const pidFile of pidFiles) {
    const serverId = pidFile.replace(".pid", "");
    const pidData = readPidFile(directoryManager, serverId);

    if (!pidData) continue;

    // Check if process is actually running
    if (isProcessRunning(pidData.pid)) {
      processes.push({
        serverId,
        pid: pidData.pid,
        startTime: new Date(pidData.startTime),
        command: pidData.command,
        args: pidData.args
      });
    } else {
      // Clean up stale PID file
      removePidFile(directoryManager, serverId);
    }
  }

  return processes;
}

/**
 * Check if a specific server is running
 */
export function isServerRunning(directoryManager: any, serverId: string): boolean {
  const pidData = readPidFile(directoryManager, serverId);

  if (!pidData) {
    return false;
  }

  if (isProcessRunning(pidData.pid)) {
    return true;
  } else {
    // Clean up stale PID file
    removePidFile(directoryManager, serverId);
    return false;
  }
}

const processes: Record<string, ChildProcess> = {};

export async function startServerProcess(
  directoryManager: any,
  id: string,
  command: string,
  args: string[],
  cwd: string
): Promise<ChildProcess> {
  logger.debug("startServerProcess called", {
    id,
    command,
    args,
    cwd,
    processExecPath: process.execPath
  });

  if (isServerRunning(directoryManager, id)) {
    throw new Error(`Server ${id} is already running`);
  }

  const cmd =
    command === "node" || command.endsWith("/node") ? process.execPath : command;
  logger.debug("Command normalized", {
    originalCommand: command,
    normalizedCmd: cmd
  });

  const [rawScriptPath, ...restArgs] = args ?? [];
  if (!rawScriptPath) {
    throw new Error("startServerProcess: no script path provided in args[0]");
  }
  logger.debug("Script path extraction", { rawScriptPath, restArgs });

  const scriptPath = path.isAbsolute(rawScriptPath)
    ? rawScriptPath
    : path.resolve(cwd, rawScriptPath);
  logger.debug("Script path resolution", {
    rawScriptPath,
    isAbsolute: path.isAbsolute(rawScriptPath),
    resolvedScriptPath: scriptPath,
    cwd
  });

  if (!fs.existsSync(scriptPath)) {
    logger.error(`MCP server script not found: ${scriptPath}`, undefined, {
      scriptPath,
      exists: fs.existsSync(scriptPath)
    });
    throw new Error(`MCP server script not found: ${scriptPath}`);
  }
  logger.debug("Script file exists", { scriptPath });

  const spawnArgs =
    cmd === process.execPath ? [scriptPath, ...restArgs] : [scriptPath, ...restArgs];
  logger.debug("About to spawn process", {
    cmd,
    spawnArgs,
    cwd,
    isNodeExecPath: cmd === process.execPath
  });

  const child = spawn(cmd, spawnArgs, {
    cwd,
    stdio: "pipe",
    env: { ...process.env }
  });

  if (!child) {
    logger.error(`Failed to spawn process - child is null or undefined`, undefined, {
      id,
      cmd,
      spawnArgs,
      cwd
    });
    throw new Error(`Failed to spawn process - child is null or undefined`);
  }

  logger.debug("Process spawned", { pid: child.pid, id });

  if (!child.pid) {
    logger.error(`Failed to start process - no PID`, undefined, {
      id,
      cmd,
      spawnArgs,
      cwd
    });
    throw new Error(`Failed to start process - no PID`);
  }

  // Return a promise that handles error conditions and waits for readiness
  return new Promise((resolve, reject) => {
    const startupTimeout = setTimeout(() => {
      child.kill(); // Kill the process if it doesn't become ready in time
      reject(new Error(`Timed out waiting for server '${id}' to become ready.`));
    }, 8000); // 8-second timeout for server startup

    const cleanup = () => {
      clearTimeout(startupTimeout);
      removePidFile(directoryManager, id);
      delete processes[id];
    };

    child.once("error", err => {
      logger.error(`[MCP] Failed to start server '${id}'`, err, {
        id,
        cmd,
        spawnArgs,
        cwd
      });
      cleanup();
      reject(err);
    });

    child.once("exit", (code, signal) => {
      logger.debug(`Process ${id} exited prematurely during startup`, {
        code,
        signal,
        pid: child.pid
      });
      cleanup();
      reject(
        new Error(
          `Server process '${id}' exited prematurely with code ${code}, signal ${signal}`
        )
      );
    });

    const handleStdErr = (chunk: Buffer) => {
      const output = chunk.toString().trim();
      // Log all stderr for debugging
      if (output) {
        logger.error(`[${id}] stderr`, output, { id });
        console.error(`[MCP:${id}:stderr] ${output}`);
      }

      // Check for our readiness signal
      if (output.includes("MCP server ready")) {
        logger.info(`Server '${id}' signaled it is ready.`);
        clearTimeout(startupTimeout);
        // Remove this specific listener so we don't keep checking
        child.stderr?.removeListener("data", handleStdErr);

        // Write PID file ONLY after we know it's ready
        try {
          writePidFile(directoryManager, id, child.pid!, cmd, spawnArgs);
          processes[id] = child;

          // Now that it's ready, re-attach a simple exit listener for long-term cleanup
          child.removeAllListeners("exit"); // remove premature exit listener
          child.once("exit", (code, signal) => {
            logger.debug(`Process ${id} exited`, { code, signal, pid: child.pid });
            removePidFile(directoryManager, id);
            delete processes[id];
          });

          resolve(child);
        } catch (err) {
          logger.error(`Failed to write PID file for ${id}`, err as Error);
          child.kill();
          reject(err);
        }
      }
    };

    child.stderr?.on("data", handleStdErr);
  });
}

export async function stopServerProcess(
  directoryManager: any,
  id: string
): Promise<void> {
  // First check if there's a PID file
  const pidData = readPidFile(directoryManager, id);
  if (!pidData) {
    // Clean up in-memory process if it exists
    delete processes[id];
    return;
  }

  const pid = pidData.pid;

  // Check if process is still running
  if (!isProcessRunning(pid)) {
    // Process already dead, just cleanup
    removePidFile(directoryManager, id);
    delete processes[id];
    return;
  }

  logger.debug(`Stopping server ${id} with PID ${pid}`);

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, "SIGTERM");

    // Wait up to 5 seconds for graceful shutdown
    const timeout = 5000;
    const checkInterval = 100;
    let elapsed = 0;

    while (elapsed < timeout) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      if (!isProcessRunning(pid)) {
        // Process terminated gracefully
        logger.debug(`Server ${id} terminated gracefully`);
        break;
      }
    }

    // If still running, force kill with SIGKILL
    if (isProcessRunning(pid)) {
      logger.debug(`Server ${id} did not terminate gracefully, sending SIGKILL`);
      process.kill(pid, "SIGKILL");
    }
  } catch (err) {
    // Process might already be dead, that's ok
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") {
      logger.error(`Error stopping server ${id}:`, err as Error);
    }
  }

  // Clean up
  removePidFile(directoryManager, id);
  delete processes[id];
}

/**
 * Restart a server process
 */
export async function restartServerProcess(
  directoryManager: any,
  serverId: string,
  command: string,
  args: string[] = [],
  cwd?: string
): Promise<ChildProcess> {
  await stopServerProcess(directoryManager, serverId);

  // Wait a bit before restarting
  await new Promise(resolve => setTimeout(resolve, 500));

  return startServerProcess(
    directoryManager,
    serverId,
    command,
    args,
    cwd || process.cwd()
  );
}

/**
 * Stop all running servers
 */
export async function stopAllServers(directoryManager: any): Promise<void> {
  const runningServers = getRunningServers(directoryManager);

  const stopPromises = runningServers.map(server =>
    stopServerProcess(directoryManager, server.serverId)
  );

  await Promise.all(stopPromises);
}

/**
 * Clean up stale PID files (for servers that aren't actually running)
 */
export function cleanupStalePidFiles(directoryManager: any): number {
  ensurePidsDirectory(directoryManager);

  const pidsDir = getPidsDir(directoryManager);
  if (!fs.existsSync(pidsDir)) {
    return 0;
  }

  const pidFiles = fs.readdirSync(pidsDir).filter(file => file.endsWith(".pid"));
  let cleaned = 0;

  for (const pidFile of pidFiles) {
    const serverId = pidFile.replace(".pid", "");
    const pidData = readPidFile(directoryManager, serverId);

    if (pidData && !isProcessRunning(pidData.pid)) {
      removePidFile(directoryManager, serverId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get process information for a specific server
 */
export function getServerProcess(
  directoryManager: any,
  serverId: string
): ServerProcess | null {
  const pidData = readPidFile(directoryManager, serverId);

  if (!pidData) {
    return null;
  }

  if (isProcessRunning(pidData.pid)) {
    return {
      serverId,
      pid: pidData.pid,
      startTime: new Date(pidData.startTime),
      command: pidData.command,
      args: pidData.args
    };
  } else {
    removePidFile(directoryManager, serverId);
    return null;
  }
}

export interface ServerProcess {
  serverId: string;
  pid: number;
  startTime: Date;
  command: string;
  args: string[];
  process?: ChildProcess;
}
