import { Chat, ChatMessageLike, type ChatHistoryData } from "@lmstudio/sdk";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { state as threadState } from "../../threads";

export const listThreads = (threadsDir: string) => {
  try {
    return readdirSync(threadsDir).filter(v => v.includes(".json"));
  } catch (error) {
    // If the directory doesn't exist or we can't read it, return empty array
    if ((error as any).code === 'ENOENT') {
      // Directory doesn't exist, that's OK - return empty array
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

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
  
  // Ensure consistent message format
  const formattedMessage = {
    role: (message as any).role || (message as any).data?.role,
    content: (message as any).content || (message as any).data?.content
  };
  
  chatHistory.messages.push(formattedMessage as any);
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
        messages: messages.map((msg: any) => {
          // Handle different message formats consistently
          const role = msg.data?.role || msg.role || 'assistant';
          let content = msg.data?.content || msg.content || '';
          
          // Ensure content is in the correct format
          if (typeof content === 'string') {
            content = [{ type: 'text', text: content }];
          } else if (Array.isArray(content) && content.length === 0) {
            content = [{ type: 'text', text: '' }];
          }
          
          return {
            role,
            content
          };
        })
      };
      writeFileSync(path, JSON.stringify(chatHistory, null, 2));
    } else {
      chatHistory = { messages: [] };
    }

    threadState.active = Chat.from(chatHistory);
  }
}

// Convenience wrappers that use the default threads directory
export const listCurrentThreads = (threadsDir: string) => listThreads(threadsDir);
export const getCurrentActiveThreadPath = (threadsDir: string) =>
  getActiveThreadPath(threadsDir);
export const appendMessageToCurrentActiveThread = (
  threadsDir: string,
  message: ChatMessageLike
) => appendMessageToActiveThread(threadsDir, message);
export const removeLastMessageFromCurrentActiveThread = (threadsDir: string) =>
  removeLastMessageFromActiveThread(threadsDir);
export const hydrateCurrentThread = (threadsDir: string) => hydrate(threadsDir);
