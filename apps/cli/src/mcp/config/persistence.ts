import fs from "fs";
import path from "path";
import os from "os";
import {
  McpServerConfig,
  McpJsonConfig,
  mcpJsonToServerConfig,
  serverConfigToMcpJson
} from "../types.js";
import { validateServerConfig, validateMcpJsonConfig } from "./validation.js";
import { state as mcpState } from "../state/index.js";

const CONFIG_DIR = path.join(os.homedir(), ".sage");
const MCP_CONFIG_FILE = path.join(CONFIG_DIR, "mcp-servers.json");
const MCP_JSON_CONFIG_FILE = path.join(CONFIG_DIR, "mcp.json");

export async function loadServerConfigs(): Promise<void> {
  try {
    if (!fs.existsSync(MCP_CONFIG_FILE)) return;

    const data = await fs.promises.readFile(MCP_CONFIG_FILE, "utf-8");
    const configs = JSON.parse(data) as Record<string, McpServerConfig>;

    for (const [id, config] of Object.entries(configs)) {
      const validation = validateServerConfig(config);
      if (validation.isValid) {
        mcpState.serverConfigs[id] = config;
      } else {
        console.warn(`Invalid server config "${id}":`, validation.errors);
      }
    }
  } catch (error: any) {
    throw new Error("Failed to load MCP server configs:" + error.message);
  }
}

export async function saveServerConfigs(): Promise<void> {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      await fs.promises.mkdir(CONFIG_DIR, { recursive: true });
    }

    const data = JSON.stringify(mcpState.serverConfigs, null, 2);
    await fs.promises.writeFile(MCP_CONFIG_FILE, data, "utf-8");
  } catch (error: any) {
    throw new Error("Failed to save MCP server configs: " + error.message);
  }
}

export async function loadMcpJsonConfig(
  filePath?: string,
  addConfigFn?: (config: McpServerConfig) => Promise<void>
): Promise<void> {
  const configPaths = filePath
    ? [filePath]
    : [
        path.join(process.cwd(), ".mcp.json"),
        path.join(process.cwd(), "mcp.json"),
        MCP_JSON_CONFIG_FILE
      ];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const data = await fs.promises.readFile(configPath, "utf-8");
      const mcpConfig = JSON.parse(data) as McpJsonConfig;
      const { isValid, errors } = validateMcpJsonConfig(mcpConfig);

      if (!isValid && errors.length) {
        throw new Error(`MCP config invalid: ${errors.toString()}`);
      }

      for (const [serverName, jsonConfig] of Object.entries(mcpConfig.mcpServers)) {
        const serverConfig = mcpJsonToServerConfig(serverName, jsonConfig);
        if (!mcpState.serverConfigs[serverConfig.id]) {
          if (addConfigFn) {
            await addConfigFn(serverConfig);
          } else {
            mcpState.serverConfigs[serverConfig.id] = serverConfig;
          }
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to load MCP JSON config from ${configPath}: ${error.message}`
      );
    }
  }
}

export async function saveMcpJsonConfig(filePath?: string): Promise<void> {
  const configPath = filePath || MCP_JSON_CONFIG_FILE;

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      await fs.promises.mkdir(CONFIG_DIR, { recursive: true });
    }

    const mcpConfig: McpJsonConfig = {
      mcpServers: {}
    };

    for (const config of Object.values(mcpState.serverConfigs)) {
      mcpConfig.mcpServers[(config as any).name] = serverConfigToMcpJson(
        config as any
      );
    }

    const data = JSON.stringify(mcpConfig, null, 2);
    await fs.promises.writeFile(configPath, data, "utf-8");
  } catch (error: any) {
    throw new Error("Failed to save MCP JSON config: " + error.message);
  }
}
