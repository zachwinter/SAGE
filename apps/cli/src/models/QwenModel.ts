import OpenAI from "openai";
import type { Chat } from "@lmstudio/sdk";
import { qwenAuth } from "../auth/QwenDeviceAuth.js";

export class QwenModel {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string = "qwen-plus") {
    this.model = model;
  }

  private async ensureAuthenticated(): Promise<OpenAI> {
    if (this.client) return this.client;

    // Authenticate with Qwen with retry logic
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const authenticated = await qwenAuth.authenticate();
        if (!authenticated) {
          throw new Error("Failed to authenticate with Qwen");
        }

        const accessToken = await qwenAuth.getAccessToken();
        const resourceUrl = qwenAuth.getResourceUrl();

        if (!accessToken) {
          throw new Error("No access token available");
        }

        // Create OpenAI client with Qwen credentials
        // Adding dangerouslyAllowBrowser to avoid browser environment warnings in tests
        this.client = new OpenAI({
          apiKey: accessToken,
          baseURL:
            resourceUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
          dangerouslyAllowBrowser: true
        });

        return this.client;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors that are likely user-related
        if (
          error instanceof Error &&
          (error.message.includes("Failed to authenticate") ||
            error.message.includes("No access token"))
        ) {
          throw error;
        }

        // For network errors, retry with exponential backoff
        const shouldRetry =
          attempt < maxRetries &&
          ((error instanceof Error && error.message.includes("network")) ||
            (error instanceof Error && error.message.includes("timeout")) ||
            (error instanceof Error && error.message.includes("fetch")));

        if (!shouldRetry) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(
          `🔐 Auth retry attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms due to: ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Failed to authenticate after retries");
  }

  async act(
    chat: Chat,
    tools: any[],
    options: {
      signal: AbortSignal;
      onRoundStart?: (roundIndex: number) => void;
      onStreamPart?: (part: string) => void;
    }
  ): Promise<string> {
    // Retry logic for transient failures
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.ensureAuthenticated();

        // Convert Chat to OpenAI format
        const messages = chat.toOpenAIFormat();

        const stream = await client.chat.completions.create({
          model: this.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          stream: true,
          temperature: 0.1
        });

        let response = "";

        for await (const chunk of stream) {
          if (options.signal.aborted) {
            throw new Error("Request aborted");
          }

          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            response += delta;
            options.onStreamPart?.(delta);
          }
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort or authentication errors
        if (
          error instanceof Error &&
          (error.name === "AbortError" || options.signal.aborted)
        ) {
          throw error;
        }

        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes("authenticate")) {
          throw error;
        }

        // For rate limiting (429) or temporary server errors (500-599), retry with exponential backoff
        const shouldRetry =
          attempt < maxRetries &&
          ((error instanceof Error && error.message.includes("429")) ||
            (error instanceof Error && /5[0-9]{2}/.test(error.message)) ||
            (error instanceof Error && error.message.includes("timeout")) ||
            (error instanceof Error && error.message.includes("network")));

        if (!shouldRetry) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(
          `📡 Retry attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms due to: ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Failed to complete request after retries");
  }

  async clearAuth(): Promise<void> {
    await qwenAuth.clearCredentials();
    this.client = null;
  }
}
