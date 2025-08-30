import { checkTTY, Logger, getConfigPathDI, getThreadsDirDI, type DirectoryManager } from "@sage/utils";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { render } from "ink";

import { settings } from "../config/index";
import { state as modelState } from "../models/state.js";
import { Router } from "../router/Router.js";
import { state } from "../router/state.js";
import { state as threadState } from "../threads/state/index.js";
import { hydrate } from "../threads/utils/persistence";

const logger = new Logger("CLI");

function initializeConfig(directoryManager: DirectoryManager) {
  modelState.selectedModel = settings.defaultModel;
  threadState.activeThreadId = `${new Date().valueOf()}`;
  const content = {
    selectedModel: modelState.selectedModel,
    activeThread: threadState.activeThreadId
  };
  
  const configPath = getConfigPathDI(directoryManager);
  const configDir = path.dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  writeFileSync(configPath, JSON.stringify(content, null, 2));
}

function loadMessages(directoryManager: DirectoryManager) {
  const configPath = getConfigPathDI(directoryManager);
  const { selectedModel, activeThread } = JSON.parse(
    readFileSync(configPath).toString()
  );
  threadState.activeThreadId = activeThread;
  modelState.selectedModel = selectedModel;
  
  const threadsDir = getThreadsDirDI(directoryManager);
  if (!existsSync(threadsDir)) {
    mkdirSync(threadsDir, { recursive: true });
  }
  
  hydrate(threadsDir);

  if (threadState.refreshSavedThreads) {
    threadState.refreshSavedThreads();
  }
}

export async function ask(directoryManager: DirectoryManager) {
  checkTTY();

  logger.info("Ink application initializing.");

  if (state.initialized) return;

  const configPath = getConfigPathDI(directoryManager);
  if (!existsSync(configPath)) {
    initializeConfig(directoryManager);
  } else {
    loadMessages(directoryManager);
  }

  logger.info("Using built-in tools only (MCP disabled for testing)");

  state.initialized = true;
  logger.info("Sage app initialization complete.");

  console.clear();
  render(<Router />);
}
