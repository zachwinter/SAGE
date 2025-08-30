import { LMStudioClient } from "@lmstudio/sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getSageDirDI } from "@sage/utils";
import { state } from "./state.js";
import { OpenAIModel } from "./OpenAIModel.js";
import { QwenModel } from "./QwenModel.js";
import {
  qwenAuth,
  qwenAuthEvents,
  QwenAuthEventType
} from "../auth/QwenDeviceAuth.js";
import { modelEvents, ModelEventType } from "./modelEvents.js";

let client: LMStudioClient | null = null;

function getClient() {
  if (!client) {
    client = new LMStudioClient();
  }
  return client;
}

// Listen for Qwen auth events to trigger model updates
qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, () => {
  console.log("Qwen auth success, triggering model update");
  modelEvents.emit(ModelEventType.ModelsUpdated);
});

qwenAuthEvents.on(QwenAuthEventType.AuthFailure, () => {
  console.log("Qwen auth failure, triggering model update");
  modelEvents.emit(ModelEventType.ModelsUpdated);
});

qwenAuthEvents.on(QwenAuthEventType.TokenRefreshed, () => {
  console.log("Qwen token refreshed, triggering model update");
  modelEvents.emit(ModelEventType.ModelsUpdated);
});

// OpenAI/Cloud model definitions
const OPENAI_MODELS = [
  // OpenAI models
  { modelKey: "openai:gpt-4", name: "GPT-4", provider: "openai" },
  { modelKey: "openai:gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
  { modelKey: "openai:gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai" },

  // Qwen models via DashScope
  { modelKey: "qwen:qwen-coder", name: "Qwen Coder (Cloud)", provider: "qwen" },
  { modelKey: "qwen:qwen-turbo", name: "Qwen Turbo (Cloud)", provider: "qwen" },
  { modelKey: "qwen:qwen-plus", name: "Qwen Plus (Cloud)", provider: "qwen" },

  // Qwen models via ModelScope (free tier)
  {
    modelKey: "qwen-ms:Qwen/Qwen2.5-Coder-32B-Instruct",
    name: "Qwen2.5 Coder 32B (ModelScope)",
    provider: "qwen-modelscope"
  }
];

// Qwen OAuth models - only shown after successful authentication
const QWEN_OAUTH_MODELS = [
  {
    modelKey: "qwen-oauth:qwen-plus",
    name: "Qwen Plus (OAuth)",
    provider: "qwen-oauth"
  },
  {
    modelKey: "qwen-oauth:qwen-turbo",
    name: "Qwen Turbo (OAuth)",
    provider: "qwen-oauth"
  },
  {
    modelKey: "qwen-oauth:qwen-coder",
    name: "Qwen Coder (OAuth)",
    provider: "qwen-oauth"
  }
];

export async function listDownloaded(directoryManager: any) {
  const lmStudioModels = await getClient().system.listDownloadedModels();

  // Add cloud models to the list
  const cloudModels = OPENAI_MODELS.map(model => ({
    modelKey: model.modelKey,
    name: model.name,
    provider: model.provider,
    isCloud: true
  }));

  // Check if Qwen OAuth is authenticated and add those models if so
  const qwenOAuthModels = [];
  try {
    // Try to get a token to check if authenticated
    const token = await qwenAuth.getAccessToken();
    if (token) {
      QWEN_OAUTH_MODELS.forEach(model => {
        qwenOAuthModels.push({
          modelKey: model.modelKey,
          name: model.name,
          provider: model.provider,
          isCloud: true
        });
      });
    }
  } catch (error) {
    // Not authenticated, don't show OAuth models
    console.debug("Qwen OAuth not authenticated, hiding OAuth models");
  }

  return [...lmStudioModels, ...cloudModels, ...qwenOAuthModels];
}

export async function listLoaded() {
  return getClient().llm.listLoaded();
}

export async function selectModel(
  directoryManager: any,
  modelKey: string,
  onProgress?: any
) {
  // Check if this is a cloud model
  const isCloudModel = OPENAI_MODELS.some(model => model.modelKey === modelKey);

  if (isCloudModel) {
    // For cloud models, just save the selection - no loading needed
    try {
      const configPath = path.join(getSageDirDI(directoryManager), "config.json");

      if (existsSync(configPath)) {
        const file = readFileSync(configPath).toString();
        const parsed = JSON.parse(file);
        parsed.selectedModel = modelKey;
        writeFileSync(configPath, JSON.stringify(parsed, null, 2));
      } else {
        writeFileSync(
          configPath,
          JSON.stringify({ selectedModel: modelKey }, null, 2)
        );
      }

      state.selectedModel = modelKey;
      return { success: true };
    } catch (e) {
      return { success: false, error: e };
    }
  }

  // For LM Studio models, use the original logic
  const loaded = await listLoaded();
  const models = new Set(loaded.map(m => m.modelKey));

  if (!models.has(modelKey)) {
    const loaded = await listLoaded();
    await Promise.all(loaded.map(model => getClient().llm.unload(model.modelKey)));
  }

  try {
    await getClient().llm.model(modelKey, { verbose: false, onProgress });
    const configPath = path.join(getSageDirDI(directoryManager), "config.json");

    if (existsSync(configPath)) {
      const file = readFileSync(configPath).toString();
      const parsed = JSON.parse(file);
      parsed.selectedModel = modelKey;
      writeFileSync(configPath, JSON.stringify(parsed, null, 2));
    } else {
      writeFileSync(
        configPath,
        JSON.stringify({ selectedModel: modelKey }, null, 2)
      );
    }

    state.selectedModel = modelKey;

    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}

export function getSelectedModel(directoryManager: any) {
  if (state.selectedModel === null) return null;

  // Check if this is a cloud model
  const cloudModel = OPENAI_MODELS.find(
    model => model.modelKey === state.selectedModel
  );

  if (cloudModel) {
    // Create appropriate cloud model instance
    const provider = cloudModel.provider;

    if (provider === "openai") {
      return new OpenAIModel({
        apiKey: process.env.OPENAI_API_KEY!,
        baseURL: process.env.OPENAI_BASE_URL,
        model: state.selectedModel.replace("openai:", "") // Remove prefix
      });
    }

    if (provider === "qwen") {
      return new OpenAIModel({
        apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY!,
        baseURL:
          process.env.DASHSCOPE_BASE_URL ||
          "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: state.selectedModel.replace("qwen:", "") // Remove prefix
      });
    }

    if (provider === "qwen-modelscope") {
      return new OpenAIModel({
        apiKey: process.env.MODELSCOPE_API_KEY || process.env.OPENAI_API_KEY!,
        baseURL:
          process.env.MODELSCOPE_BASE_URL ||
          "https://api-inference.modelscope.cn/v1",
        model: state.selectedModel.replace("qwen-ms:", "") // Remove prefix
      });
    }

    if (provider === "qwen-oauth") {
      return new QwenModel(state.selectedModel.replace("qwen-oauth:", "")); // Remove prefix
    }
  }

  // Default to LM Studio model
  return getClient().llm.model(state.selectedModel);
}
