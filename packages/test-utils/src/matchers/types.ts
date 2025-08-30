// Types for custom matchers

import type { TempWorkspace } from "../index.js";

// Custom matcher result type
export interface MatcherResult {
  pass: boolean;
  message(): string;
}

// Directory structure comparison types
export interface DirectoryStructure {
  [path: string]: string; // path -> content
}

// Chronicle event matching types
export interface EventPattern {
  type?: string;
  eventId?: string;
  actor?: {
    agent?: string;
    id?: string;
  };
  [key: string]: any;
}

// Graph node validation types
export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
  first_seen?: string;
  last_seen?: string;
}

// Transaction boundary validation types
export interface TransactionState {
  stagingDir: string;
  productionDir: string;
  operations: Array<{
    type: "read" | "write" | "edit" | "delete";
    path: string;
    timestamp: string;
  }>;
}

// Matcher function types
export type DirectoryMatcher = (received: TempWorkspace, expected: DirectoryStructure) => Promise<MatcherResult>;
export type ChronicleEventMatcher = (received: any[], pattern: EventPattern) => MatcherResult;
export type GraphNodeMatcher = (received: GraphNode | GraphNode[]) => MatcherResult;
export type TransactionMatcher = (received: TransactionState) => MatcherResult;