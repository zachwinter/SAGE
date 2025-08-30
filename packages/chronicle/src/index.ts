// Export all types
export type {
  ChroniclePath,
  Actor,
  ChronicleEventBase,
  AppendOptions,
  ChronicleEvent,
  // Specific event types
  PlanDraftedEvent,
  PlanApprovedEvent,
  PlanDeniedEvent,
  PlanUnsafeEvent,
  HaltAndReportEvent,
  ReconciliationEvent,
  RogueEditDetectedEvent,
  BuildEvent,
  DeployEvent,
  EnvvarChangeEvent,
  PostmortemEvent,
  FileAddedEvent,
  FileRemovedEvent,
  FileRenamedEvent,
  FileSplitEvent,
  FileMergedEvent,
} from './types.js';

// Export core API functions
export {
  appendEvent,
  readChronicle,
  tailChronicle,
  validateChroniclePath,
} from './api.js';

// Export file operations for advanced use cases
export {
  readChronicleFile,
  tailChronicleFile,
  ensureChronicleDirectory,
  serializeEvent,
  fileExists,
} from './file-operations.js';

// Export file locking utilities
export {
  acquireLock,
  cleanStaleLocks,
} from './file-locking.js';

// Export atomic operations
export {
  atomicAppendEvent,
  deduplicateConsecutiveEvents,
} from './atomic-append.js';

// Export canonicalization utilities
export {
  canonicalizeEvent,
  computeEventId,
  verifyEventId,
  computeEventIds,
  computeChronicleHash,
  eventsAreIdentical,
  findDuplicateEvents,
} from './canonicalization.js';

// Export causal chain utilities
export {
  buildCausalChain,
  validateCausalChain,
  getCompleteChain,
  getChainTail,
  appendWithCausalChain,
} from './causal-chain.js';
export type { ChainLink, ChainValidationResult } from './causal-chain.js';

// Export optimization utilities
export {
  isDuplicateEvent,
  isDuplicateUsingIndex,
  maintainEventIndex,
  batchCheckDuplicates,
} from './optimization.js';

// Export analysis and repair utilities
export {
  analyzeChronicle,
  repairChronicle,
  formatAnalysisReport,
} from './analysis.js';
export type { 
  ChronicleAnalysis, 
  ChronicleRepairOptions, 
  ChronicleRepairResult 
} from './analysis.js';

// Export validation functions and type guards
export {
  isPlanDraftedEvent,
  isPlanApprovedEvent,
  isPlanDeniedEvent,
  isPlanUnsafeEvent,
  isHaltAndReportEvent,
  isReconciliationEvent,
  isRogueEditDetectedEvent,
  isBuildEvent,
  isDeployEvent,
  isEnvvarChangeEvent,
  isPostmortemEvent,
  isFileAddedEvent,
  isFileRemovedEvent,
  isFileRenamedEvent,
  isFileSplitEvent,
  isFileMergedEvent,
  getEventType,
  filterEventsByType,
  hasEventFields,
} from './validation.js';