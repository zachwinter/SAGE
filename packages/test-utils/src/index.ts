// Story 1: Temp FS & Workspace Harnesses
export { 
  TempFS, 
  createTempFS, 
  withTempDir,
  createTempWorkspace,
  type TempWorkspace,
  buildTree
} from "./temp-fs.js";
export { golden, expectDirEquals } from "./golden.js";

// Story 2: In-Memory Adapters
export {
  makeGraphAdapter,
  makeChronicle,
  makeLLM,
  makeTools,
  type GraphAdapter,
  type ChronicleAdapter,
  type LLMClient,
  type ToolRegistry
} from "./adapters/index.js";

// Story 3: Agent Scenario DSL & Harnesses
export {
  scenario,
  type Scenario,
  type Plan,
  type Approve,
  type Deny,
  type Agent,
  type ExecutionReport
} from "./scenarios/index.js";

// Story 4: Protocol Matchers & Assertions
export {
  toEqualDir,
  toContainEvent,
  toBeCommitAddressable,
  toRespectTransactionBoundary,
  setupMatchers,
  type DirectoryMatcher,
  type ChronicleEventMatcher,
  type GraphNodeMatcher,
  type TransactionMatcher
} from "./matchers/index.js";

// Vitest Configuration Factory
export {
  createSageVitestConfig,
  vitestConfigs,
  setupHelpers,
  type SageVitestOptions
} from "./vitest.js";
