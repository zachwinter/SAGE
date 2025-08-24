// Standard ES imports - much simpler and should work with NODE_PATH
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import fs from "fs";
import fsPromises from "fs/promises";

// --- START DEBUG LOGGING ---
const LOG_FILE = "/tmp/mcp_server_e2e_log.txt";
// Clear the log file at the start of the script
fs.writeFileSync(LOG_FILE, "");
const log = message => {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
};
// --- END DEBUG LOGGING ---

// Wrap everything in a try/catch to log any crash
try {
  log("Server script starting up.");

  // Create server instance
  const server = new Server(
    {
      name: "test-e2e-server",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );
  log("Server instance created.");

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "echo",
          description: "Echo back a message.",
          inputSchema: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
            additionalProperties: false
          }
        },
        {
          name: "create_file",
          description: "Create a file with given content.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: { type: "string" },
              content: { type: "string" }
            },
            required: ["filePath", "content"],
            additionalProperties: false
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "echo":
        return { content: [{ type: "text", text: args.message }] };
      case "create_file":
        // Use the promises version here as before
        await fsPromises.writeFile(args.filePath, args.content, "utf-8");
        return {
          content: [{ type: "text", text: `File created at ${args.filePath}` }]
        };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
  log("Tool handlers registered.");

  // Add handlers for new required methods
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });
  log("Resource and prompt handlers registered.");

  // Connect to transport
  const transport = new StdioServerTransport();
  log("Transport created. Attempting to connect...");

  // This is the most likely place for it to hang or fail
  server
    .connect(transport)
    .then(() => {
      log("SUCCESS: server.connect() promise resolved.");
      console.error("MCP server ready");
    })
    .catch(err => {
      log(`ERROR: server.connect() promise rejected: ${err.stack}`);
    });

  log("server.connect() called. Script is now in event loop.");
  console.error("Fixed MCP server started with all required handlers!");
} catch (e) {
  log(`FATAL SCRIPT CRASH: ${e.message}\n${e.stack}`);
  // Also write to stderr in case it's visible
  console.error(`FATAL SCRIPT CRASH: ${e.message}`);
  process.exit(1); // Ensure it exits on a crash
}
