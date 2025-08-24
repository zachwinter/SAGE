import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { mcpClientManager } from "../../client/MCPClientManager";
import { mcpState } from "../../state/state";
import { stopServerProcess } from "../../process/manager";
import { vi } from "vitest";
import Logger from "../../../logger/logger";
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-e2e-test-"));
};

async function waitFor(
  fn: () => boolean,
  { timeoutMs = 10000, intervalMs = 50, label = "condition" } = {}
) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const t = setInterval(() => {
      if (fn()) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, intervalMs);
  });
}

describe("MCP E2E Workflow", () => {
  let tempHomeDir: string;
  let serverId: string;

  beforeAll(async () => {
    console.log("🚨 E2E TEST STARTING - CONSOLE LOG!");
    Logger.info("🚨 E2E test beforeAll starting - LOGGER!");

    console.log("🚨 About to create temp directory");
    Logger.info("🚨 About to create temp directory");
    tempHomeDir = createTempDir();
    console.log("🚨 Created temp directory:", tempHomeDir);
    Logger.info("🚨 Created temp directory", { tempHomeDir });

    console.log("🚨 About to mock homedir");
    Logger.info("🚨 About to mock homedir");
    vi.spyOn(os, "homedir").mockReturnValue(tempHomeDir);
    console.log("🚨 Mocked homedir to:", tempHomeDir);
    Logger.info("🚨 Mocked homedir", { tempHomeDir });

    console.log("🚨 About to resolve fixture directory");
    Logger.info("🚨 About to resolve fixture directory");
    const fixtureDir = path.resolve(
      __dirname,
      "../../../__tests__/fixtures/mcp-server"
    );
    console.log("🚨 Fixture directory resolved:", fixtureDir);
    Logger.info("🚨 Fixture directory resolved", { fixtureDir });

    console.log("🚨 About to create server config");
    Logger.info("🚨 About to create server config");
    const config = {
      id: "e2e-test-server",
      name: "E2E Test Server",
      type: "stdio" as const,
      command: "node", // Use "node" directly instead of process.execPath // use the current Node
      args: [path.join(fixtureDir, "server.js")],
      enabled: true,
      cwd: process.cwd() // if your manager supports this; otherwise pass as param
    };
    serverId = config.id;
    console.log("🚨 Created server config:", JSON.stringify(config, null, 2));
    Logger.info("🚨 Created server config", { config, fixtureDir });

    console.log("🚨 About to add server to client manager");
    Logger.info("🚨 About to add server to client manager");
    // register client + connect (this handles the process spawning)
    await mcpClientManager.addServer(config);
    console.log("🚨 Server added to client manager successfully!");
    Logger.info("🚨 Server added to client manager successfully!");

    console.log("🚨 About to connect to server");
    Logger.info("🚨 About to connect to server");
    await mcpClientManager.connectServer(serverId);
    console.log("🚨 Server connection initiated successfully!");
    Logger.info("🚨 Server connection initiated successfully!");

    // wait for actual connected state
    Logger.debug("Waiting for server status to be 'connected'");
    Logger.debug("Current server state", {
      serverState: mcpState.servers?.[serverId]
    });

    await waitFor(
      () => {
        const server = mcpState.servers?.[serverId];
        Logger.debug("Checking server status", { status: server?.status, serverId });
        return server?.status === "connected";
      },
      {
        timeoutMs: 10000,
        label: "MCP server connect"
      }
    );
  }, 60000);

  afterAll(async () => {
    await stopServerProcess(serverId);
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should connect to the server and list its capabilities", () => {
    const server = mcpState.servers[serverId];
    expect(server).toBeDefined();
    expect(server.status).toBe("connected");

    const tools = mcpState.availableTools;
    expect(tools.length).toBe(2);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain("echo");
    expect(toolNames).toContain("create_file");
  });

  it("should execute the 'echo' tool and get a response", async () => {
    const result = await mcpClientManager.callTool(serverId, "echo", {
      message: "hello world"
    });
    expect(result.content[0].text).toBe("hello world");
  });

  it("should execute the 'create_file' tool and verify the side effect", async () => {
    const testFilePath = path.join(tempHomeDir, "test-file.txt");
    const fileContent = "This file was created by an E2E test.";

    await mcpClientManager.callTool(serverId, "create_file", {
      filePath: testFilePath,
      content: fileContent
    });

    const createdContent = fs.readFileSync(testFilePath, "utf-8");
    expect(createdContent).toBe(fileContent);
  });
});
