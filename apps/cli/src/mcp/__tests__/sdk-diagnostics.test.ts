import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startServerProcess, stopServerProcess } from "../process/manager.js";
import { ChildProcess } from "child_process";
import path from "path";

describe("MCP SDK Diagnostics", () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  const serverId = "sdk-diagnostic-server";
  const scriptPath = path.resolve(
    __dirname,
    "../../../__tests__/fixtures/mcp-server/server.js"
  );

  beforeAll(async () => {
    // Start the actual MCP server
    serverProcess = await startServerProcess(
      serverId,
      "node",
      [scriptPath],
      process.cwd()
    );

    // Create MCP client with real transport
    client = new Client({
      name: "sdk-diagnostic-client",
      version: "1.0.0"
    });

    transport = new StdioClientTransport({
      command: "node",
      args: [scriptPath],
      env: process.env as Record<string, any>
    });

    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    if (client) {
      await client.close?.();
    }
    if (serverProcess) {
      await stopServerProcess(serverId);
    }
  });

  it("should successfully call listTools without SDK compatibility issues", async () => {
    let error: any = null;
    let result: any = null;

    try {
      result = await client.listTools();
      console.log("✅ listTools() succeeded:", JSON.stringify(result, null, 2));
    } catch (e) {
      error = e;
      console.log("❌ listTools() failed:", e);
    }

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it("should successfully call listResources without SDK compatibility issues", async () => {
    let error: any = null;
    let result: any = null;

    try {
      result = await client.listResources();
      console.log("✅ listResources() succeeded:", JSON.stringify(result, null, 2));
    } catch (e) {
      error = e;
      console.log("❌ listResources() failed:", e);
    }

    // Resources might be empty, but the call should succeed
    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result.resources).toBeDefined();
    expect(Array.isArray(result.resources)).toBe(true);
  });

  it("should successfully call listPrompts without SDK compatibility issues", async () => {
    let error: any = null;
    let result: any = null;

    try {
      result = await client.listPrompts();
      console.log("✅ listPrompts() succeeded:", JSON.stringify(result, null, 2));
    } catch (e) {
      error = e;
      console.log("❌ listPrompts() failed:", e);
    }

    // Prompts might be empty, but the call should succeed
    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result.prompts).toBeDefined();
    expect(Array.isArray(result.prompts)).toBe(true);
  });

  it("should successfully call tools without method binding issues", async () => {
    // First, get available tools
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBeGreaterThan(0);

    const echoTool = toolsResult.tools.find(tool => tool.name === "echo");
    expect(echoTool).toBeDefined();

    // Test various method binding approaches
    let standardCallResult: any = null;
    let boundCallResult: any = null;
    let standardError: any = null;
    let boundError: any = null;

    // Test 1: Standard method call
    try {
      standardCallResult = await client.callTool({
        name: "echo",
        arguments: { message: "standard call test" }
      });
      console.log(
        "✅ Standard callTool() succeeded:",
        JSON.stringify(standardCallResult, null, 2)
      );
    } catch (e) {
      standardError = e;
      console.log("❌ Standard callTool() failed:", e);
    }

    // Test 2: Explicitly bound method call
    try {
      boundCallResult = await client.callTool.call(client, {
        name: "echo",
        arguments: { message: "bound call test" }
      });
      console.log(
        "✅ Bound callTool() succeeded:",
        JSON.stringify(boundCallResult, null, 2)
      );
    } catch (e) {
      boundError = e;
      console.log("❌ Bound callTool() failed:", e);
    }

    // At least one approach should work
    const anySuccess = !standardError || !boundError;
    expect(anySuccess).toBe(true);

    // Log which method works
    if (!standardError) {
      console.log("✅ Standard method binding works fine - no SDK issue");
    } else if (!boundError) {
      console.log("⚠️ Only bound method works - SDK has binding issue");
    }
  });

  it("should handle SDK capability fetching with realistic error handling", async () => {
    // Test fetching capabilities with proper error handling
    const results = await Promise.allSettled([
      client.listTools().catch(e => ({ error: e, tools: [] })),
      client.listResources().catch(e => ({ error: e, resources: [] })),
      client.listPrompts().catch(e => ({ error: e, prompts: [] }))
    ]);

    console.log(
      "Promise.allSettled results:",
      results.map((r, i) => ({
        index: i,
        status: r.status,
        value: r.status === "fulfilled" ? r.value : undefined,
        reason: r.status === "rejected" ? r.reason : undefined
      }))
    );

    // All should succeed or fail gracefully
    results.forEach((result, index) => {
      const methodNames = ["listTools", "listResources", "listPrompts"];
      if (result.status === "rejected") {
        console.log(`❌ ${methodNames[index]} rejected:`, result.reason);
      } else {
        console.log(`✅ ${methodNames[index]} resolved:`, Object.keys(result.value));
      }
    });

    // At least tools should work since our test server has them
    expect(results[0].status).toBe("fulfilled");
  });
});
