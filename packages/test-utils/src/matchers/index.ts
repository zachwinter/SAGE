// Protocol Matchers & Assertions for Story 4
export { 
  toEqualDir, 
  toContainEvent, 
  toBeCommitAddressable, 
  toRespectTransactionBoundary
} from "./matchers.js";

export type {
  DirectoryMatcher,
  ChronicleEventMatcher,
  GraphNodeMatcher,
  TransactionMatcher
} from "./types.js";

// Export setup function for test framework integration
export { setupMatchers } from "./setup.js";