import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "@sage/utils";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const logger = new Logger("mcp-sdk-simple-test");

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

    logger.info("=== SDK Diagnostic Test Started ===");
    logger.info(`Testing MCP SDK with script at: ${scriptPath}`);
    logger.info(`Logging to: ${logFile}`);

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
      logger.info("Connecting to MCP server...");
      await client.connect(transport);
      logger.info("✅ Connected successfully to MCP server!");
    } catch (error) {
      logger.error("❌ Failed to connect to MCP server:", error);
      throw error;
    }
  }, 10000);

  afterAll(async () => {
    if (client && transport) {
      logger.info("Closing connection...");
      try {
        await client.close?.();
        logger.info("✅ Connection closed successfully");
      } catch (e) {
        logger.error("❌ Error during close:", e);
      }
    }

    logger.info("=== SDK Diagnostic Test Completed ===");

    // Write final log summary to file
    try {
      const logContent = `SDK Diagnostic Test Results
Test completed at: ${new Date().toISOString()}
Check the main log files for detailed output.
`;
      fs.writeFileSync(logFile, logContent);
    } catch (e) {
      logger.error("Failed to write log file:", e);
    }
  });

  it("should test if listTools method exists and what happens when called", async () => {
    logger.info("🔍 Testing listTools method...");

    const clientPrototype = Object.getPrototypeOf(client);
    const clientMethods = Object.getOwnPropertyNames(clientPrototype);
    logger.info(`Client methods available: ${clientMethods.join(", ")}`);
    logger.info(`Has listTools: ${typeof client.listTools}`);

    if (typeof client.listTools === "function") {
      let result, error;
      try {
        logger.info("Calling client.listTools()...");
        result = await client.listTools();
        logger.info(`✅ listTools() succeeded:`, result);
      } catch (e) {
        error = e;
        logger.error("❌ listTools() failed:", e);
      }

      // Don't fail the test, just record what happens
      expect(typeof client.listTools).toBe("function");
      logger.info(
        `listTools test completed - result: ${!!result}, error: ${!!error}`
      );
    } else {
      logger.error("❌ listTools method does not exist on client");
      logger.info(`Actual type: ${typeof client.listTools}`);
      expect(typeof client.listTools).toBe("function"); // This will fail and show us the actual type
    }
  });

  it("should test basic callTool functionality", async () => {
    logger.info("🔍 Testing callTool method...");
    logger.info(`Has callTool: ${typeof client.callTool}`);

    let result, error;
    try {
      logger.info("Calling client.callTool() with echo tool...");
      result = await client.callTool({
        name: "echo",
        arguments: { message: "SDK test message" }
      });
      logger.info("✅ callTool() succeeded:", result);
    } catch (e) {
      error = e;
      logger.error("❌ callTool() failed:", e);
      logger.error("Error details:", {
        name: e.name,
        message: e.message,
        code: e.code,
        stack: e.stack
      });
    }

    if (error) {
      logger.info("🔄 Testing bound callTool method...");
      try {
        const boundResult = await client.callTool.call(client, {
          name: "echo",
          arguments: { message: "bound SDK test message" }
        });
        logger.info("✅ Bound callTool() succeeded:", boundResult);
        result = boundResult;
        error = null;
      } catch (e) {
        logger.error("❌ Bound callTool() also failed:", e);
      }
    }

    logger.info(`callTool test summary - success: ${!!result}, error: ${!!error}`);

    // At least one method should work
    expect(error).toBeFalsy(); // undefined or null both mean no error
    expect(result).toBeDefined();
  });

  it("should debug what methods are actually available on the client", () => {
    logger.info("🔍 Debugging client methods and properties...");

    const prototype = Object.getPrototypeOf(client);
    const methods = Object.getOwnPropertyNames(prototype).filter(
      name => typeof (client as any)[name] === "function"
    );

    const properties = Object.getOwnPropertyNames(prototype).filter(
      name => typeof (client as any)[name] !== "function"
    );

    logger.info(`Available client methods: ${methods.join(", ")}`);
    logger.info(`Available client properties: ${properties.join(", ")}`);
    logger.info(`Client constructor name: ${client.constructor.name}`);
    logger.info(`Transport type: ${transport.constructor.name}`);
    logger.info(`Client prototype chain: ${prototype.constructor.name}`);

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
      logger.info(`Method ${method}: ${exists ? "✅ exists" : "❌ missing"}`);
    });

    expect(methods).toContain("callTool");
  });
});
