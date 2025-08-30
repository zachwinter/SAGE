export interface Operation {
  id: string;
  type: "agent" | "parallel" | "sequential" | "conditional" | "loop";
  name?: string;
  config: OperationConfig;
  dependencies: string[];
}

export interface OperationConfig {
  model?: string;
  role?: string; // was: role: string;
  task?: string; // was: task: string;
  schema?: any;
  input?: string | string[];
  temperature?: number;
  prompt?: string;
  maxTokens?: number;
  condition?: string;
  iterations?: number;
  operations?: Operation[];
}
