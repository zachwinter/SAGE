// src/index.ts
// Main entry point for @sage/llm

export type {
  Role,
  ChatMessage,
  ToolSchema,
  ChatOptions,
  StreamEvent,
  LLMProvider,
  ToolCallInfo,
  StreamOptions,
  EventContext,
  StreamEventWithContext
} from "./types.js";

export {
  isTextEvent,
  isToolCallEvent,
  isToolResultEvent,
  isToolValidationErrorEvent,
  isRoundStartEvent,
  isRoundEndEvent,
  isErrorEvent,
  isEndEvent
} from "./types.js";

export { setProvider, listModels } from "./registry.js";
export { 
  createChatStream,
  registerTool,
  unregisterTool,
  getToolValidator,
  getSecurityPolicyManager,
  getToolCallManager,
  configureToolSecurity,
  getCacheMetrics,
  clearCache,
  getCacheSize,
  configureCache
} from "./api.js";
export { 
  AsyncQueue, 
  mergeStreams, 
  mapStream, 
  filterStream,
  withErrorBoundary,
  withTimeout,
  bufferStream
} from "./stream-utils.js";

export {
  registerEventNormalizer,
  normalizeEventStream,
  withEventNormalization,
  OpenAIEventNormalizer,
  AnthropicEventNormalizer
} from "./event-normalization.js";

export type {
  EventNormalizer,
  NormalizationContext
} from "./event-normalization.js";

// Tool validation exports
export {
  ToolValidator,
  defaultToolValidator,
  createSecureToolValidator,
  CommonToolSchemas
} from "./tool-validation.js";

export type {
  ValidationResult,
  ValidationError,
  ValidationOptions
} from "./tool-validation.js";

// Tool lifecycle exports
export {
  ToolCallManager,
  generateCallId,
  defaultToolCallManager
} from "./tool-lifecycle.js";

export type {
  ToolCall,
  ToolCallState,
  ToolExecutor,
  ToolRegistry,
  ToolLifecycleEvent,
  ToolCallManagerOptions
} from "./tool-lifecycle.js";

// Security policy exports
export {
  SecurityPolicyManager,
  BuiltinPolicies,
  defaultSecurityPolicyManager
} from "./security-policies.js";

export type {
  PolicyResult,
  SecurityPolicy,
  PolicyContext,
  PolicyViolation,
  DetailedPolicyResult
} from "./security-policies.js";

// Provider adapter exports
export {
  BaseAdapter,
  ProviderFactory,
  AdapterRegistry,
  OpenAIAdapter,
  AnthropicAdapter,
  LMStudioAdapter,
  createLMStudioAdapter,
  isLMStudioAvailable,
  TestProvider,
  TestProviderFactory,
  createAdapter,
  listAdapters
} from "./adapters/index.js";

export type {
  ProviderConfig,
  ModelInfo,
  OpenAIConfig,
  AnthropicConfig,
  LMStudioConfig,
  LMStudioDeps,
  Chat,
  LMStudioModel,
  TestProviderConfig,
  TestResponse
} from "./adapters/index.js";

// Cache system exports
export {
  DefaultCacheKeyGenerator,
  defaultCacheKeyGenerator,
  MemoryCache,
  defaultMemoryCache,
  CacheManager,
  defaultCacheManager
} from "./cache/index.js";

export type {
  CacheMode,
  CacheOptions,
  CachedResult,
  CacheKeyComponents,
  CacheMetrics,
  LLMCache,
  CacheKeyGenerator,
  CacheLookupResult
} from "./cache/index.js";