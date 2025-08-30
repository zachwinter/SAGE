import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { McpServerConfig } from "..";
import { DirectoryManager } from "@sage/utils";
import { getSageDirDI } from "../utils/directories.js";

export interface ServerMetadata {
  name: string;
  github: string;
  installedPath: string;
  entryPoint?: string;
  entryType?: "python" | "node";
  hasPackageJson?: boolean;
  hasPythonFile?: boolean;
}

/**
 * Get the servers directory path
 */
function getServersDir(directoryManager: DirectoryManager): string {
  return path.join(getSageDirDI(directoryManager), "servers");
}

/**
 * Ensure the servers directory exists
 */
export function ensureServersDirectory(directoryManager: DirectoryManager): void {
  const serversDir = getServersDir(directoryManager);
  if (!fs.existsSync(serversDir)) {
    fs.mkdirSync(serversDir, { recursive: true });
  }
}

/**
 * Get the local path for a server based on its GitHub URL
 */
export function getServerPath(
  directoryManager: DirectoryManager,
  githubUrl: string
): string {
  const serversDir = getServersDir(directoryManager);
  const repoName = extractRepoName(githubUrl);
  return path.join(serversDir, repoName);
}

/**
 * Extract repository name from GitHub URL
 */
function extractRepoName(githubUrl: string): string {
  const match = githubUrl.match(/github\.com\/[^\/]+\/([^\/]+?)(?:\.git)?(?:\/)?$/);
  if (match?.[1]) {
    return match[1].replace(".git", "");
  }
  return "unknown";
}

/**
 * Check if a server is already installed
 */
export function isServerInstalled(
  directoryManager: DirectoryManager,
  githubUrl: string
): boolean {
  const serverPath = getServerPath(directoryManager, githubUrl);
  return fs.existsSync(serverPath) && fs.existsSync(path.join(serverPath, ".git"));
}

/**
 * Clone a server from GitHub
 */
export async function cloneServer(
  directoryManager: DirectoryManager,
  githubUrl: string,
  name: string
): Promise<string> {
  ensureServersDirectory(directoryManager);

  const serverPath = getServerPath(directoryManager, githubUrl);

  if (isServerInstalled(directoryManager, githubUrl)) {
    throw new Error(`Server already installed at ${serverPath}`);
  }

  return new Promise((resolve, reject) => {
    const git = spawn("git", ["clone", githubUrl, serverPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let output = "";
    let errorOutput = "";

    git.stdout?.on("data", data => {
      output += data.toString();
    });

    git.stderr?.on("data", data => {
      errorOutput += data.toString();
    });

    git.on("close", code => {
      if (code === 0) {
        resolve(serverPath);
      } else {
        reject(new Error(`Git clone failed: ${errorOutput}`));
      }
    });

    git.on("error", error => {
      reject(new Error(`Failed to spawn git: ${error.message}`));
    });
  });
}

/**
 * Remove an installed server
 */
export async function removeServer(
  directoryManager: DirectoryManager,
  githubUrl: string
): Promise<void> {
  const serverPath = getServerPath(directoryManager, githubUrl);

  if (!fs.existsSync(serverPath)) {
    return; // Already removed
  }

  // Remove the entire directory
  await fs.promises.rm(serverPath, { recursive: true, force: true });
}

/**
 * Detect the entry point for a cloned server
 */
export function detectServerEntryPoints(serverPath: string): Array<{
  name: string;
  entryPoint: string;
  entryType: "python" | "node";
  description?: string;
}> {
  const servers: Array<{
    name: string;
    entryPoint: string;
    entryType: "python" | "node";
    description?: string;
  }> = [];

  // Function to scan a directory that has Python package indicators
  const scanPythonPackage = (packagePath: string, packageName: string) => {
    try {
      // Look for server.py in the package
      const serverPyPath = path.join(packagePath, "server.py");
      if (fs.existsSync(serverPyPath)) {
        const content = fs.readFileSync(serverPyPath, "utf-8");
        if (
          content.includes("mcp") ||
          content.includes("FastMCP") ||
          content.includes("@server.")
        ) {
          servers.push({
            name: packageName,
            entryPoint: serverPyPath,
            entryType: "python",
            description: `Python MCP server: ${packageName}`
          });
          return;
        }
      }

      // Look for server.py in src subdirectory
      const srcPath = path.join(packagePath, "src");
      if (fs.existsSync(srcPath)) {
        const srcEntries = fs.readdirSync(srcPath);
        for (const srcEntry of srcEntries) {
          const srcEntryPath = path.join(srcPath, srcEntry);
          if (fs.statSync(srcEntryPath).isDirectory()) {
            const serverPyInSrc = path.join(srcEntryPath, "server.py");
            if (fs.existsSync(serverPyInSrc)) {
              const content = fs.readFileSync(serverPyInSrc, "utf-8");
              if (
                content.includes("mcp") ||
                content.includes("FastMCP") ||
                content.includes("@server.")
              ) {
                servers.push({
                  name: packageName,
                  entryPoint: serverPyInSrc,
                  entryType: "python",
                  description: `Python MCP server: ${packageName}`
                });
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip packages we can't read
    }
  };

  // Recursive function to scan directories
  const scanDirectory = (dirPath: string, depth: number = 0) => {
    // Limit recursion depth to avoid infinite loops
    if (depth > 3) return;

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);

        if (
          stat.isDirectory() &&
          !entry.startsWith(".") &&
          entry !== "node_modules"
        ) {
          // Check if this directory has Python package indicators
          const hasPyprojectToml = fs.existsSync(
            path.join(fullPath, "pyproject.toml")
          );
          const hasSetupPy = fs.existsSync(path.join(fullPath, "setup.py"));
          const hasRequirementsTxt = fs.existsSync(
            path.join(fullPath, "requirements.txt")
          );

          if (hasPyprojectToml || hasSetupPy || hasRequirementsTxt) {
            // This looks like a Python package - scan it for servers
            scanPythonPackage(fullPath, entry);
          } else {
            // Continue scanning subdirectories
            scanDirectory(fullPath, depth + 1);
          }
        }
      }
    } catch (error) {
      // Skip if can't read directory
    }
  };

  // Start scanning from the root
  scanDirectory(serverPath, 0);

  // Check for package.json with multiple scripts
  const packageJsonPath = path.join(serverPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const scripts = packageJson.scripts || {};

      // Look for MCP-related scripts
      Object.keys(scripts).forEach(scriptName => {
        if (
          scriptName.includes("mcp") ||
          scriptName.includes("server") ||
          scriptName === "start" ||
          scripts[scriptName].includes("mcp")
        ) {
          servers.push({
            name: scriptName,
            entryPoint: `npm run ${scriptName}`,
            entryType: "node",
            description: `Node.js MCP server: ${scriptName}`
          });
        }
      });
    } catch (error) {
      console.warn(`Failed to parse package.json at ${packageJsonPath}:`, error);
    }
  }

  // If no specific servers found, fall back to common entry points
  if (servers.length === 0) {
    const commonFiles = [
      { files: ["server.py", "main.py", "app.py"], type: "python" as const },
      {
        files: ["index.js", "server.js", "app.js", "main.js"],
        type: "node" as const
      }
    ];

    for (const { files, type } of commonFiles) {
      for (const file of files) {
        const filePath = path.join(serverPath, file);
        if (fs.existsSync(filePath)) {
          const baseName = file.split(".")[0];
          servers.push({
            name: baseName,
            entryPoint: filePath,
            entryType: type,
            description: `${type} server: ${baseName}`
          });
          break; // Only take first match per type
        }
      }
    }
  }

  return servers;
}

// Keep the old function for backward compatibility
export function detectServerEntryPoint(serverPath: string): {
  entryPoint?: string;
  entryType?: "python" | "node";
} {
  const servers = detectServerEntryPoints(serverPath);
  if (servers.length > 0) {
    return {
      entryPoint: servers[0].entryPoint,
      entryType: servers[0].entryType
    };
  }
  return {};
}

/**
 * Scan the servers directory and return metadata for all installed servers
 */
export function scanInstalledServers(
  directoryManager: DirectoryManager
): ServerMetadata[] {
  ensureServersDirectory(directoryManager);

  const servers: ServerMetadata[] = [];
  const serversDir = getServersDir(directoryManager);

  if (!fs.existsSync(serversDir)) {
    return servers;
  }

  const entries = fs.readdirSync(serversDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const serverPath = path.join(serversDir, entry.name);
    const gitPath = path.join(serverPath, ".git");

    // Only include if it's a git repository
    if (!fs.existsSync(gitPath)) continue;

    try {
      // Try to extract GitHub URL from git config
      const gitConfigPath = path.join(gitPath, "config");
      let githubUrl = "";

      if (fs.existsSync(gitConfigPath)) {
        const gitConfig = fs.readFileSync(gitConfigPath, "utf-8");
        const match = gitConfig.match(/url = (https:\/\/github\.com\/[^\s]+)/);
        githubUrl = match?.[1] || "";
      }

      const detection = detectServerEntryPoint(serverPath);

      servers.push({
        name: entry.name,
        github: githubUrl,
        installedPath: serverPath,
        entryPoint: detection.entryPoint,
        entryType: detection.entryType,
        hasPackageJson: fs.existsSync(path.join(serverPath, "package.json")),
        hasPythonFile: detection.entryType === "python"
      });
    } catch (error) {
      // Skip servers we can't read
      console.warn(`Failed to read server metadata for ${entry.name}:`, error);
    }
  }

  return servers;
}

/**
 * Generate multiple server configs from a single repository
 */
export function generateServerConfigs(
  directoryManager: DirectoryManager,
  repoPath: string,
  repoName: string,
  githubUrl: string
): McpServerConfig[] {
  const configs: McpServerConfig[] = [];
  const detectedServers = detectServerEntryPoints(repoPath);

  for (const server of detectedServers) {
    const id = server.name; // Use the unique subdirectory name as ID
    const displayName = `${repoName}: ${server.name.replace(repoName + "-", "")}`; // Clean up redundant prefix

    if (server.entryType === "python") {
      configs.push({
        id,
        name: displayName,
        type: "stdio",
        command: process.platform === "win32" ? "python" : "python3",
        args: [server.entryPoint],
        enabled: false, // Disabled by default until user enables
        env: {
          // --> THIS IS THE CRUCIAL PART <--
          // It needs to point to the root of the cloned repo.
          PYTHONPATH: repoPath
        }
      });
    } else if (server.entryType === "node") {
      // Handle npm scripts vs direct file execution
      if (server.entryPoint.startsWith("npm ")) {
        const [command, ...args] = server.entryPoint.split(" ");
        configs.push({
          id,
          name: `${repoName}: ${server.name}`,
          type: "stdio",
          command,
          args,
          enabled: false,
          env: {}
        });
      } else {
        configs.push({
          id,
          name: displayName,
          type: "stdio",
          command: "node",
          args: [server.entryPoint],
          enabled: false,
          env: {
            NODE_PATH: repoPath
          }
        });
      }
    }
  }

  return configs;
}

/**
 * Convert server metadata to MCP server config
 */
export function serverMetadataToConfig(
  metadata: ServerMetadata
): McpServerConfig | null {
  if (!metadata.entryPoint || !metadata.entryType) {
    return null; // Can't create config without entry point
  }

  const id = metadata.name;

  if (metadata.entryType === "python") {
    return {
      id,
      name: metadata.name,
      type: "stdio",
      command: process.platform === "win32" ? "python" : "python3",
      args: [metadata.entryPoint],
      enabled: false, // Disabled by default until user enables
      env: {
        // Add the server directory to PYTHONPATH if needed
        PYTHONPATH: metadata.installedPath
      }
    };
  } else if (metadata.entryType === "node") {
    // Handle npm scripts vs direct file execution
    if (metadata.entryPoint.startsWith("npm ")) {
      const [command, ...args] = metadata.entryPoint.split(" ");
      return {
        id,
        name: metadata.name,
        type: "stdio",
        command,
        args,
        enabled: false,
        env: {
          NODE_PATH: metadata.installedPath
        }
      };
    } else {
      return {
        id,
        name: metadata.name,
        type: "stdio",
        command: process.execPath, // Use current Node.js executable
        args: [metadata.entryPoint],
        enabled: false,
        env: {
          NODE_PATH: metadata.installedPath
        }
      };
    }
  }

  return null;
}

/**
 * Update server (git pull)
 */
export async function updateServer(
  directoryManager: DirectoryManager,
  githubUrl: string
): Promise<void> {
  const serverPath = getServerPath(directoryManager, githubUrl);

  if (!isServerInstalled(directoryManager, githubUrl)) {
    throw new Error("Server not installed");
  }

  return new Promise((resolve, reject) => {
    const git = spawn("git", ["pull"], {
      cwd: serverPath,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let errorOutput = "";

    git.stderr?.on("data", data => {
      errorOutput += data.toString();
    });

    git.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git pull failed: ${errorOutput}`));
      }
    });

    git.on("error", error => {
      reject(new Error(`Failed to spawn git: ${error.message}`));
    });
  });
}
