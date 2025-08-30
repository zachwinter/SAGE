export interface AgentRequest {
  model: string;
  prompt?: string;
  role?: string;
  task?: string;
  input?: string;
  schema?: string;
  config: AgentConfig;
}

export interface AgentConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  role?: string;
}

export interface AgentResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: Date;
  executionTime: number;
}
