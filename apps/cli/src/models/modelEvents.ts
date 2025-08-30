import { EventEmitter } from "events";

export enum ModelEventType {
  ModelsUpdated = "models-updated"
}

export const modelEvents = new EventEmitter();
