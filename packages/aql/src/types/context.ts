export interface ExecutionResult {
  query: string;
  results: Record<string, any>;
  metadata: {
    totalTime: number;
    totalTokens: number;
    operationsExecuted: number;
    errors: ExecutionError[];
  };
}

export interface ExecutionError {
  operation: string;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface ExecutionContext {
  variables: Record<string, any>;
  results: Record<string, any>;
  config: ExecutionConfig;
}

export interface ExecutionConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  caching: boolean;
  debug: boolean;
}
