import { proxy } from "valtio";

export interface ModelsState {
  selectedModel: string | null;
}

export const state = proxy<ModelsState>({
  selectedModel: null
});
