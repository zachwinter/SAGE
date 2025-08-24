import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "../../logger/logger.js";
import path from "path";
import fs from "fs";

describe("MCP SDK Simple Test", () => {
  let client: Client;
  let transport: StdioClientTransport;
  const scriptPath = path.resolve(
    __dirname,
    "../../../__tests__/fixtures/mcp-server/server.js"
  );
  const logFile = path.resolve(__dirname, "sdk-diagnostic.log");

  beforeAll(async () => {
    // Clear previous log
    try {
      fs.unlinkSync(logFile);
    } catch {}

    Logger.info("=== SDK Diagnostic Test Started ===");
    Logger.info(`Testing MCP SDK with script at: ${scriptPath}`);
    Logger.info(`Logging to: ${logFile}`);

    // Create MCP client with real transport - no separate process
    client = new Client({
      name: "sdk-simple-test-client",
      version: "1.0.0"
    });

    transport = new StdioClientTransport({
      command: "node",
      args: [scriptPath],
      env: process.env as Record<string, any>
    });

    try {
      Logger.info("Connecting to MCP server...");
      await client.connect(transport);
      Logger.info("✅ Connected successfully to MCP server!");
    } catch (error) {
      Logger.error("❌ Failed to connect to MCP server:", error);
      throw error;
    }
  }, 10000);

  afterAll(async () => {
    if (client && transport) {
      Logger.info("Closing connection...");
      try {
        await client.close?.();
        Logger.info("✅ Connection closed successfully");
      } catch (e) {
        Logger.error("❌ Error during close:", e);
      }
    }

    Logger.info("=== SDK Diagnostic Test Completed ===");

    // Write final log summary to file
    try {
      const logContent = `SDK Diagnostic Test Results
Test completed at: ${new Date().toISOString()}
Check the main log files for detailed output.
`;
      fs.writeFileSync(logFile, logContent);
    } catch (e) {
      Logger.error("Failed to write log file:", e);
    }
  });

  it("should test if listTools method exists and what happens when called", async () => {
    Logger.info("🔍 Testing listTools method...");

    const clientPrototype = Object.getPrototypeOf(client);
    const clientMethods = Object.getOwnPropertyNames(clientPrototype);
    Logger.info(`Client methods available: ${clientMethods.join(", ")}`);
    Logger.info(`Has listTools: ${typeof client.listTools}`);

    if (typeof client.listTools === "function") {
      let result, error;
      try {
        Logger.info("Calling client.listTools()...");
        result = await client.listTools();
        Logger.info(`✅ listTools() succeeded:`, result);
      } catch (e) {
        error = e;
        Logger.error("❌ listTools() failed:", e);
      }

      // Don't fail the test, just record what happens
      expect(typeof client.listTools).toBe("function");
      Logger.info(
        `listTools test completed - result: ${!!result}, error: ${!!error}`
      );
    } else {
      Logger.error("❌ listTools method does not exist on client");
      Logger.info(`Actual type: ${typeof client.listTools}`);
      expect(typeof client.listTools).toBe("function"); // This will fail and show us the actual type
    }
  });

  it("should test basic callTool functionality", async () => {
    Logger.info("🔍 Testing callTool method...");
    Logger.info(`Has callTool: ${typeof client.callTool}`);

    let result, error;
    try {
      Logger.info("Calling client.callTool() with echo tool...");
      result = await client.callTool({
        name: "echo",
        arguments: { message: "SDK test message" }
      });
      Logger.info("✅ callTool() succeeded:", result);
    } catch (e) {
      error = e;
      Logger.error("❌ callTool() failed:", e);
      Logger.error("Error details:", {
        name: e.name,
        message: e.message,
        code: e.code,
        stack: e.stack
      });
    }

    if (error) {
      Logger.info("🔄 Testing bound callTool method...");
      try {
        const boundResult = await client.callTool.call(client, {
          name: "echo",
          arguments: { message: "bound SDK test message" }
        });
        Logger.info("✅ Bound callTool() succeeded:", boundResult);
        result = boundResult;
        error = null;
      } catch (e) {
        Logger.error("❌ Bound callTool() also failed:", e);
      }
    }

    Logger.info(`callTool test summary - success: ${!!result}, error: ${!!error}`);

    // At least one method should work
    expect(error).toBeFalsy(); // undefined or null both mean no error
    expect(result).toBeDefined();
  });

  it("should debug what methods are actually available on the client", () => {
    Logger.info("🔍 Debugging client methods and properties...");

    const prototype = Object.getPrototypeOf(client);
    const methods = Object.getOwnPropertyNames(prototype).filter(
      name => typeof (client as any)[name] === "function"
    );

    const properties = Object.getOwnPropertyNames(prototype).filter(
      name => typeof (client as any)[name] !== "function"
    );

    Logger.info(`Available client methods: ${methods.join(", ")}`);
    Logger.info(`Available client properties: ${properties.join(", ")}`);
    Logger.info(`Client constructor name: ${client.constructor.name}`);
    Logger.info(`Transport type: ${transport.constructor.name}`);
    Logger.info(`Client prototype chain: ${prototype.constructor.name}`);

    // Check if standard MCP methods exist
    const expectedMethods = [
      "callTool",
      "listTools",
      "listResources",
      "listPrompts",
      "readResource",
      "getPrompt"
    ];
    expectedMethods.forEach(method => {
      const exists = typeof (client as any)[method] === "function";
      Logger.info(`Method ${method}: ${exists ? "✅ exists" : "❌ missing"}`);
    });

    expect(methods).toContain("callTool");
  });
});
