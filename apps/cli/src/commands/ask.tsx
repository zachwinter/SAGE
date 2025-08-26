import { Logger } from "@sage/utils";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { render } from "ink";
import { settings } from "../config/index";
import { initializeMcp } from "../mcp";
import { state as modelState } from "../models/state.js";
import { Router } from "../router/Router.js";
import { state } from "../router/state.js";
import { state as threadState } from "../threads/state/index.js";
import { cleanupOldStreamingToolCalls } from "../threads/streaming/actions.js";
import { hydrateCurrentThread } from "../threads/utils/persistence";
import { initializeToolCallCleanup } from "../tools/utils/tool-cleanup";
import { config } from "../utils/directories.js";
import { checkTTY } from "../utils/tty.js";

const logger = new Logger("CLI");

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

export async function ask() {
  checkTTY();

  logger.info("Ink application initializing.");

  if (state.initialized) return;

  if (!existsSync(config)) {
    initializeConfig();
  } else {
    loadMessages();
  }

  logger.debug("Initializing cleanup utilities.");
  cleanupOldStreamingToolCalls();
  initializeToolCallCleanup();

  try {
    logger.info("Initializing MCP system...");
    await initializeMcp();
    logger.info("MCP system initialized successfully.");
  } catch (error) {
    logger.error("Failed to initialize MCP system", error as Error);
  }

  state.initialized = true;
  logger.info("Sage app initialization complete.");

  console.clear();
  render(<Router />);
}
