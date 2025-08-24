import { cleanupOldStreamingToolCalls } from "../../threads/streaming/actions";

let cleanupInterval: NodeJS.Timeout | null = null;

export function startToolCallCleanup(intervalMs: number = 60000) {
  if (cleanupInterval) clearInterval(cleanupInterval);

  cleanupInterval = setInterval(() => {
    try {
      cleanupOldStreamingToolCalls();
    } catch (error) {
      console.warn("Failed to cleanup old tool calls:", error);
    }
  }, intervalMs);
}

export function stopToolCallCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function initializeToolCallCleanup() {
  startToolCallCleanup();
  if (typeof process !== "undefined") {
    process.on("exit", stopToolCallCleanup);
    process.on("SIGINT", stopToolCallCleanup);
    process.on("SIGTERM", stopToolCallCleanup);
  }
}
