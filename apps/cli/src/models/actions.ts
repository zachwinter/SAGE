import { LMStudioClient } from "@lmstudio/sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { sage } from "../utils/directories";
import { state } from "./state.js";

const client = new LMStudioClient();

export async function listDownloaded() {
  return client.system.listDownloadedModels();
}

export async function listLoaded() {
  return client.llm.listLoaded();
}

export async function selectModel(modelKey: string, onProgress?: any) {
  const loaded = await listLoaded();
  const models = new Set(loaded.map(m => m.modelKey));

  if (!models.has(modelKey)) {
    const loaded = await listLoaded();
    await Promise.all(loaded.map(model => client.llm.unload(model.modelKey)));
  }

  try {
    await client.llm.model(modelKey, { verbose: false, onProgress });
    const config = path.join(sage, "config.json");

    if (existsSync(config)) {
      const file = readFileSync(config).toString();
      const parsed = JSON.parse(file);
      parsed.selectedModel = modelKey;
      writeFileSync(config, JSON.stringify(parsed, null, 2));
    } else {
      writeFileSync(config, JSON.stringify({ selectedModel: modelKey }, null, 2));
    }

    state.selectedModel = modelKey;

    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}

export function getSelectedModel() {
  if (state.selectedModel === null) return null;
  return client.llm.model(state.selectedModel);
}
