import { Chat, ChatMessageLike, type ChatHistoryData } from "@lmstudio/sdk";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { state as threadState } from "../../threads";
import { threads } from "../../utils/directories";

export const listThreads = (threadsDir: string) =>
  readdirSync(threadsDir).filter(v => v.includes(".json"));

export function getActiveThreadPath(threadsDir: string, threadId?: string) {
  const activeThreadId =
    threadId || threadState.activeThreadId || `${new Date().valueOf()}`;
  if (!threadState.activeThreadId) {
    threadState.activeThreadId = activeThreadId;
  }
  const activeThread = path.join(threadsDir, activeThreadId + ".json");
  if (!existsSync(activeThread)) {
    const emptyChatHistory: ChatHistoryData = { messages: [] };
    writeFileSync(activeThread, JSON.stringify(emptyChatHistory));
  }
  return activeThread;
}

export function appendMessageToActiveThread(
  threadsDir: string,
  message: ChatMessageLike
) {
  const path = getActiveThreadPath(threadsDir);
  const chatHistory: ChatHistoryData = JSON.parse(readFileSync(path).toString());
  chatHistory.messages.push(message as any);
  writeFileSync(path, JSON.stringify(chatHistory, null, 2));
}

export function removeLastMessageFromActiveThread(threadsDir: string) {
  const path = getActiveThreadPath(threadsDir);
  const chatHistory: ChatHistoryData = JSON.parse(readFileSync(path).toString());
  if (chatHistory.messages.length > 0) {
    chatHistory.messages.pop();
    writeFileSync(path, JSON.stringify(chatHistory, null, 2));
  }
}

export function hydrate(threadsDir: string) {
  const path = getActiveThreadPath(threadsDir);

  if (!existsSync(path)) {
    const emptyChatHistory: ChatHistoryData = { messages: [] };
    writeFileSync(path, JSON.stringify(emptyChatHistory));
    threadState.active = Chat.from(emptyChatHistory);
  } else {
    const { messages } = JSON.parse(readFileSync(path).toString());
    let chatHistory: ChatHistoryData;
    if (Array.isArray(messages)) {
      chatHistory = {
        messages: messages.map((msg: any) => ({
          role: msg.data?.role || msg.role,
          content: msg.data?.content || msg.content
        }))
      };
      writeFileSync(path, JSON.stringify(chatHistory, null, 2));
    } else {
      chatHistory = { messages };
    }

    threadState.active = Chat.from(chatHistory);
  }
}

// Convenience wrappers that use the default threads directory
export const listCurrentThreads = () => listThreads(threads);
export const getCurrentActiveThreadPath = () => getActiveThreadPath(threads);
export const appendMessageToCurrentActiveThread = (message: ChatMessageLike) =>
  appendMessageToActiveThread(threads, message);
export const removeLastMessageFromCurrentActiveThread = () =>
  removeLastMessageFromActiveThread(threads);
export const hydrateCurrentThread = () => hydrate(threads);
