import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mcpClientManager } from "../../client/MCPClientManager";
import { stopServerProcess } from "../../process/manager";
import { mcpState } from "../../state/state";

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
    tempHomeDir = createTempDir();

    vi.spyOn(os, "homedir").mockReturnValue(tempHomeDir);

    const fixtureDir = path.resolve(
      __dirname,
      "../../../__tests__/fixtures/mcp-server"
    );

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
    await mcpClientManager.addServer(config);

    await mcpClientManager.connectServer(serverId);

    await waitFor(
      () => {
        const server = mcpState.servers?.[serverId];

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
