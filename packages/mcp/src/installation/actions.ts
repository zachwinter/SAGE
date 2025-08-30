import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { mcpClientManager } from "../client/index.js";
import { saveServerConfigs } from "../config/index.js";
import {
  mcpState,
  setInstallLoading,
  setInstallStatus,
  updateInstallStatus
} from "../state/index.js";
import {
  cloneServer,
  generateServerConfigs,
  isServerInstalled,
  removeServer,
  scanInstalledServers
} from "./filesystem.js";
import mcpRegistry from "./registry.js";

// Define interfaces for dependencies to make testing easier
export interface FileSystemOps {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean };
  mkdirSync(path: string, options?: any): void;
  readFileSync(path: string, encoding: BufferEncoding): string;
  promises: {
    writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
    mkdir(path: string, options?: any): Promise<void>;
    rm(path: string, options?: any): Promise<void>;
  };
}

export interface ProcessSpawner {
  spawn(command: string, args: string[], options?: any): any;
}

export interface PathOps {
  join(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
}

export interface OsOps {
  homedir(): string;
}

const defaultFileSystemOps: FileSystemOps = fs;
const defaultProcessSpawner: ProcessSpawner = { spawn };
const defaultPathOps: PathOps = path;
const defaultOsOps: OsOps = os;

// DirectoryManager instance for this module
let directoryManager: any = null;

/**
 * Set the DirectoryManager for this module
 */
export function setDirectoryManager(dm: any) {
  directoryManager = dm;
}

async function installServerDependencies(
  repoPath: string,
  deps: {
    fileSystem?: FileSystemOps;
    pathOps?: PathOps;
    processSpawner?: ProcessSpawner;
  } = {}
): Promise<void> {
  const fs = deps.fileSystem || defaultFileSystemOps;
  const pathOps = deps.pathOps || defaultPathOps;
  const processSpawner = deps.processSpawner || defaultProcessSpawner;

  try {
    // Check root directory first
    await installNodeDependencies(repoPath, {
      fileSystem: fs,
      pathOps: pathOps,
      processSpawner
    });
    await installPythonPackage(repoPath, pathOps.basename(repoPath), {
      fileSystem: fs,
      pathOps: pathOps,
      processSpawner
    });

    // Then check subdirectories for monorepos
    const entries = fs.readdirSync(repoPath);

    for (const entry of entries) {
      const fullPath = path.join(repoPath, entry);
      if (!fs.statSync(fullPath).isDirectory() || entry.startsWith(".")) continue;
      if (entry === "servers") {
        const serverEntries = fs.readdirSync(fullPath);
        for (const serverEntry of serverEntries) {
          const serverPath = path.join(fullPath, serverEntry);
          if (fs.statSync(serverPath).isDirectory()) {
            await installPythonPackage(serverPath, serverEntry, {
              fileSystem: fs,
              pathOps: path,
              processSpawner
            });
            await installNodeDependencies(serverPath, {
              fileSystem: fs,
              pathOps: path,
              processSpawner
            });
          }
        }
      } else {
        await installPythonPackage(fullPath, entry, {
          fileSystem: fs,
          pathOps: path,
          processSpawner
        });
        await installNodeDependencies(fullPath, {
          fileSystem: fs,
          pathOps: path,
          processSpawner
        });
      }
    }
  } catch (error: any) {
    throw new Error(`Failed to install dependencies: ${error.message}`);
  }
}

async function installNodeDependencies(
  packagePath: string,
  deps: {
    fileSystem?: FileSystemOps;
    pathOps?: PathOps;
    processSpawner?: ProcessSpawner;
  } = {}
): Promise<void> {
  const fs = deps.fileSystem || defaultFileSystemOps;
  const pathOps = deps.pathOps || defaultPathOps;
  const processSpawner = deps.processSpawner || defaultProcessSpawner;
  const packageJsonPath = pathOps.join(packagePath, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    await new Promise<void>((resolve, reject) => {
      const install = processSpawner.spawn("npm", ["install"], {
        cwd: packagePath,
        stdio: "pipe"
      });

      install.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error("npm install failed with non-zero exit code."));
        }
      });

      install.on("error", reject);
    });
  }
}

async function installPythonPackage(
  packagePath: string,
  packageName: string,
  deps: {
    fileSystem?: FileSystemOps;
    pathOps?: PathOps;
    processSpawner?: ProcessSpawner;
  } = {}
): Promise<void> {
  const fs = deps.fileSystem || defaultFileSystemOps;
  const pathOps = deps.pathOps || defaultPathOps;
  const processSpawner = deps.processSpawner || defaultProcessSpawner;

  const hasPyprojectToml = fs.existsSync(path.join(packagePath, "pyproject.toml"));
  const hasRequirementsTxt = fs.existsSync(
    path.join(packagePath, "requirements.txt")
  );
  const hasSetupPy = fs.existsSync(path.join(packagePath, "setup.py"));
  if (!hasPyprojectToml && !hasRequirementsTxt && !hasSetupPy) return;

  return new Promise((resolve, reject) => {
    let command = "uv";
    let args = ["sync"];
    const checkUv = processSpawner.spawn("which", ["uv"], { stdio: "pipe" });

    checkUv.on("close", (code: number) => {
      if (code !== 0) {
        command = "pip";
        args = ["install", "-e", "."];
      }

      const install = processSpawner.spawn(command, args, {
        cwd: packagePath,
        stdio: "pipe"
      });

      install.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject({ error: `${packageName} installation unsuccessful` });
        }
      });

      install.on("error", reject);
    });
  });
}

export async function syncFilesystemServers(
  deps: {
    fileSystem?: FileSystemOps;
    pathOps?: PathOps;
    osOps?: OsOps;
  } = {}
): Promise<void> {
  if (!directoryManager) {
    throw new Error("DirectoryManager not set. Call setDirectoryManager() first.");
  }

  const fs = deps.fileSystem || defaultFileSystemOps;
  const pathOps = deps.pathOps || defaultPathOps;
  const os = deps.osOps || defaultOsOps;

  const SERVERS_DIR = pathOps.join(os.homedir(), ".sage", "servers");

  if (!fs.existsSync(SERVERS_DIR)) return;

  try {
    const serverDirs = fs.readdirSync(SERVERS_DIR).filter(entry => {
      const serverPath = path.join(SERVERS_DIR, entry);
      return fs.statSync(serverPath).isDirectory() && entry !== ".DS_Store";
    });

    for (const serverDir of serverDirs) {
      const serverPath = path.join(SERVERS_DIR, serverDir);
      const configs = generateServerConfigs(
        directoryManager,
        serverPath,
        serverDir,
        `filesystem:${serverDir}`
      );

      for (const config of configs) {
        if (!mcpState.serverConfigs[config.id]) {
          mcpState.serverConfigs[config.id] = config;
        }
      }
    }

    for (const [id, config] of Object.entries(mcpState.serverConfigs)) {
      if (config.type !== "stdio") continue;
      const filesystemPaths = [config.command, ...(config.args || [])].filter(
        Boolean
      );

      for (const fsPath of filesystemPaths) {
        if (!fsPath) continue;
        if (fsPath.includes("/.sage/servers/")) {
          const pathMatch = fsPath.match(/\/\.sage\/servers\/([^\/]+)/);
          if (pathMatch && !serverDirs.includes(pathMatch[1])) {
            delete mcpState.serverConfigs[id];
            break;
          }
        }
      }
    }

    await saveServerConfigs();
  } catch (error: any) {
    throw new Error(`Failed to sync filesystem servers: ${error.message}`);
  }
}

export async function installServerFromRegistry(
  server: {
    name: string;
    github: string;
    description: string;
  },
  deps: {
    fileSystem?: FileSystemOps;
    pathOps?: PathOps;
    processSpawner?: ProcessSpawner;
  } = {}
): Promise<import("../types.js").McpServerConfig[]> {
  if (!directoryManager) {
    throw new Error("DirectoryManager not set. Call setDirectoryManager() first.");
  }

  if (isServerInstalled(directoryManager, server.github)) {
    throw new Error(`Server ${server.name} is already installed`);
  }

  try {
    const serverPath = await cloneServer(
      directoryManager,
      server.github,
      server.name
    );
    await installServerDependencies(serverPath, deps);
    const configs = generateServerConfigs(
      directoryManager,
      serverPath,
      server.name,
      server.github
    );

    for (const config of configs) {
      mcpState.serverConfigs[config.id] = config;
      await mcpClientManager.addServer(config);
    }

    if (configs.length > 0) await saveServerConfigs();

    return configs;
  } catch (error: any) {
    throw new Error(`Failed to install ${server.name}: ${error.message}`);
  }
}

export async function uninstallServer(repoName: string): Promise<void> {
  if (!directoryManager) {
    throw new Error("DirectoryManager not set. Call setDirectoryManager() first.");
  }

  const values = Object.values(mcpState.serverConfigs);

  const repoConfigs = values.filter(config => {
    const { name, id }: { name: string; id: string } = config as any;
    return name.startsWith(`${repoName}:`) || id.startsWith(repoName);
  });

  if (repoConfigs.length === 0) {
    throw new Error(`Server repository ${repoName} not found in configuration`);
  }

  try {
    const installedServers = scanInstalledServers(directoryManager);
    const serverMetadata = installedServers.find(meta => meta.name === repoName);

    if (serverMetadata && serverMetadata.github) {
      const serverIdsToRemove = Object.keys(mcpState.serverConfigs).filter(id => {
        const config = mcpState.serverConfigs[id];
        return config.name.startsWith(`${repoName}:`) || id.startsWith(repoName);
      });

      for (const serverId of serverIdsToRemove) {
        try {
          await mcpClientManager.disconnectServer(serverId);
          await mcpClientManager.removeServer(serverId);
          delete mcpState.serverConfigs[serverId];
        } catch (error: any) {
          throw new Error(
            `Failed to disconnect/remove ${serverId}: ${error.message}`
          );
        }
      }
      await removeServer(directoryManager, serverMetadata.github);
      await saveServerConfigs();
    } else {
      throw new Error(
        `Cannot uninstall ${repoName}: not a filesystem-based server or metadata not found`
      );
    }
  } catch (error: any) {
    throw new Error(`Failed to uninstall ${repoName}: ${error.message}`);
  }
}

export function isRegistryServerInstalled(server: { github: string }): boolean {
  if (!directoryManager) {
    throw new Error("DirectoryManager not set. Call setDirectoryManager() first.");
  }
  return isServerInstalled(directoryManager, server.github);
}

export function getRegistryInstallationStatus(
  registry: Array<{ name: string; github: string }>
): Record<string, boolean> {
  if (!directoryManager) {
    throw new Error("DirectoryManager not set. Call setDirectoryManager() first.");
  }

  const status: Record<string, boolean> = {};

  for (const server of registry) {
    status[server.name] = isServerInstalled(directoryManager, server.github);
  }

  return status;
}

export async function installServerWithState(server: {
  name: string;
  github: string;
  description: string;
}): Promise<void> {
  setInstallLoading(server.name, true);

  try {
    await installServerFromRegistry(server);
    updateInstallStatus(server.name, true);
  } catch (error) {
    throw error;
  } finally {
    setInstallLoading(server.name, false);
  }
}

export async function uninstallServerWithState(serverName: string): Promise<void> {
  setInstallLoading(serverName, true);

  try {
    await uninstallServer(serverName);
    updateInstallStatus(serverName, false);
  } catch (error) {
    throw error;
  } finally {
    setInstallLoading(serverName, false);
  }
}

export function initializeInstallationStatus(): void {
  const status = getRegistryInstallationStatus(mcpRegistry);
  setInstallStatus(status);
}

export async function toggleServerInstallation(server: {
  name: string;
  github: string;
  description: string;
}): Promise<void> {
  const currentState = mcpState.installationState;
  if (currentState.loading[server.name]) return;
  if (currentState.status[server.name]) {
    await uninstallServerWithState(server.name);
  } else {
    await installServerWithState(server);
  }
}
