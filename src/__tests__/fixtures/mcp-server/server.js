import { Server } from "../../../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js";
import { StdioServerTransport } from "../../../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema
} from "../../../../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";

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

// Add tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echoes the input string.",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string" }
          },
          required: ["message"]
        }
      },
      {
        name: "create_file",
        description: "Creates a file with the given content.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            content: { type: "string" }
          },
          required: ["filePath", "content"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "echo":
      return {
        content: [{ type: "text", text: args.message }]
      };

    case "create_file":
      await fs.writeFile(args.filePath, args.content, "utf-8");
      return {
        content: [{ type: "text", text: `File created at ${args.filePath}` }]
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Add handlers for new required methods
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: [] }; // OK to be empty
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: [] }; // OK to be empty
});

// Connect to transport
const transport = new StdioServerTransport(process.stdin, process.stdout);
await server.connect(transport);

console.error("Fixed MCP server started with all required handlers!");
