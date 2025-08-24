#!/usr/bin/env node

import { render } from "ink";
import { Router } from "./router/Router.js";
import { state } from "./router/state.js";
import { cleanupOldStreamingToolCalls } from "./threads/streaming/actions.js";
import { state as modelState } from "./models/state.js";
import { state as threadState } from "./threads/state/index.js";
import { initializeToolCallCleanup } from "@/tools/utils/tool-cleanup.js";
import { initializeMcp } from "@/mcp/index.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Logger from "@/logger/logger.js";
import { hydrateCurrentThread } from "@/threads/utils/persistence.js";
import { config } from "./utils/directories.js";
import { settings } from "@/config/index.js";

function initializeConfig() {
  modelState.selectedModel = settings.defaultModel;
  threadState.activeThreadId = `${new Date().valueOf()}`;
  const content = {
    selectedModel: modelState.selectedModel,
    activeThread: threadState.activeThreadId
  };
  writeFileSync(config, JSON.stringify(content, null, 2));
}

function loadMessages() {
  const { selectedModel, activeThread } = JSON.parse(
    readFileSync(config).toString()
  );
  threadState.activeThreadId = activeThread;
  modelState.selectedModel = selectedModel;
  hydrateCurrentThread();
}

export async function initializeApp() {
  Logger.info("Sage app initializing...");

  if (state.initialized) return;

  if (!existsSync(config)) {
    initializeConfig();
  } else {
    loadMessages();
  }

  Logger.debug("Initializing cleanup utilities.");
  cleanupOldStreamingToolCalls();
  initializeToolCallCleanup();

  try {
    Logger.info("Initializing MCP system...");
    await initializeMcp();
    Logger.info("MCP system initialized successfully.");
  } catch (error) {
    Logger.error("Failed to initialize MCP system", error as Error);
  }

  state.initialized = true;
  Logger.info("Sage app initialization complete.");
}

// Handle command line arguments
const args = process.argv.slice(2);

function printHelp() {
  console.log(`
sage - Interactive code analysis and chat tool

USAGE:
  sage [OPTIONS]

OPTIONS:
  -h, --help     Show this help message
  -v, --version  Show version information

DESCRIPTION:
  sage is an interactive terminal interface for code analysis and AI-powered
  conversations. When run without arguments, it starts the interactive UI.
  
  The interface supports:
  - Code analysis and visualization
  - AI-powered chat conversations  
  - MCP (Model Context Protocol) server integration
  - Thread-based conversation management

EXAMPLES:
  sage           Start the interactive interface
  sage --help    Show this help
  sage --version Show version information
`);
}

function printVersion() {
  // Read version from package.json
  const packagePath = new URL("../package.json", import.meta.url);
  try {
    const packageContent = JSON.parse(readFileSync(packagePath, "utf8"));
    console.log(`sage version ${packageContent.version}`);
  } catch (error) {
    console.log("sage version unknown");
  }
}

// Check for help or version flags
if (args.includes("--help") || args.includes("-h")) {
  Logger.info("Displaying help message.", { args });
  printHelp();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  Logger.info("Displaying version information.", { args });
  printVersion();
  process.exit(0);
}

// Check for invalid flags
const validFlags = ["--help", "-h", "--version", "-v"];
const invalidFlags = args.filter(
  arg => arg.startsWith("-") && !validFlags.includes(arg)
);
if (invalidFlags.length > 0) {
  console.error(`Error: Unknown option(s): ${invalidFlags.join(", ")}`);
  console.error("Use --help to see available options");
  process.exit(1);
}

// Check if raw mode is supported (for testing environments)
// We'll check this by testing stdin directly
try {
  const supportsRawMode =
    process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  if (!supportsRawMode) {
    console.error("Error: Interactive mode is not supported in this environment.");
    console.error(
      "This typically happens when running in non-TTY environments like CI/CD or test suites."
    );
    console.error("Raw mode is required for the interactive interface.");
    process.exit(1);
  }
} catch (error) {
  console.error("Error: Unable to initialize interactive mode.");
  process.exit(1);
}

console.clear();

initializeApp().then(() => {
  render(<Router />);
});
