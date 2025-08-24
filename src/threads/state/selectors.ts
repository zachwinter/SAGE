import { memoize } from "proxy-memoize";
import type { ThreadsState } from "./state.js";
import type { ToolCallRequest } from "@lmstudio/sdk";

export const getToolRequestMap = memoize(
  (snap: Readonly<ThreadsState>): Map<string, ToolCallRequest> => {
    const requestMap = new Map<string, ToolCallRequest>();
    const messages =
      snap.active &&
      typeof snap.active === "object" &&
      typeof snap.active.getMessagesArray === "function"
        ? snap.active.getMessagesArray()
        : [];

    messages.forEach(message => {
      try {
        const requests = message.getToolCallRequests();
        if (requests) {
          requests.forEach(req => {
            if (req?.id) {
              requestMap.set(req.id, req);
            }
          });
        }
      } catch (error) {
        console.warn("Failed to get tool call requests from message:", error);
      }
    });

    return requestMap;
  }
);
