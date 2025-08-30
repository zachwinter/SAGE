import type { ISO8601 } from '@sage/utils';

export type ChroniclePath = string & { __brand: 'ChroniclePath' };

export interface Actor {
  agent: string;
  id: string;
}

export interface ChronicleEventBase {
  type: string;
  eventId?: string;
  timestamp: ISO8601;
  actor: Actor;
  planHash?: string;
  graphCommit?: string;
  prevEventId?: string;
  tags?: string[];
}

export interface AppendOptions {
  computeId?: boolean; // default true
  lockTimeoutMs?: number; // default 2000
}

// Plan Management Events
export interface PlanDraftedEvent extends ChronicleEventBase {
  type: 'PLAN_DRAFTED';
  planId: string;
  summary: string;
  steps: unknown[];
}

export interface PlanApprovedEvent extends ChronicleEventBase {
  type: 'PLAN_APPROVED';
  planId: string;
  reviewerId: string;
  justification: string;
}

export interface PlanDeniedEvent extends ChronicleEventBase {
  type: 'PLAN_DENIED';
  planId: string;
  reviewerId: string;
  reason: string;
}

export interface PlanUnsafeEvent extends ChronicleEventBase {
  type: 'PLAN_UNSAFE';
  planId: string;
  forcedBy: string;
  overriddenWarnings: string[];
}

// Guardian & Safety Events
export interface HaltAndReportEvent extends ChronicleEventBase {
  type: 'HALT_AND_REPORT';
  invariant: string;
  expected: unknown;
  actual: unknown;
  context?: Record<string, unknown>;
}

export interface ReconciliationEvent extends ChronicleEventBase {
  type: 'RECONCILIATION';
  filePath: string;
  diffRef: string;
  reconciliationStrategy: string;
}

export interface RogueEditDetectedEvent extends ChronicleEventBase {
  type: 'ROGUE_EDIT_DETECTED';
  filePath: string;
  hash: string;
  detectedBy: string;
}

// Build & Deploy Events
export interface BuildEvent extends ChronicleEventBase {
  type: 'BUILD';
  status: 'started' | 'success' | 'failed';
  buildId?: string;
  duration?: number;
  artifacts?: string[];
  errors?: string[];
}

export interface DeployEvent extends ChronicleEventBase {
  type: 'DEPLOY';
  environment: string;
  deploymentId: string;
  status: 'started' | 'success' | 'failed' | 'rolled_back';
  buildRef?: string;
}

export interface EnvvarChangeEvent extends ChronicleEventBase {
  type: 'ENVVAR_CHANGE';
  variable: string;
  environment: string;
  operation: 'set' | 'unset' | 'changed';
  previousHash?: string;
  newHash?: string;
}

export interface PostmortemEvent extends ChronicleEventBase {
  type: 'POSTMORTEM';
  incidentId: string;
  title: string;
  rootCause: string;
  actionItems: Array<{
    description: string;
    assignee?: string;
    dueDate?: ISO8601;
  }>;
}

// File System Events
export interface FileAddedEvent extends ChronicleEventBase {
  type: 'FILE_ADDED';
  filePath: string;
  hash: string;
  size: number;
  encoding?: string;
}

export interface FileRemovedEvent extends ChronicleEventBase {
  type: 'FILE_REMOVED';
  filePath: string;
  lastHash: string;
  reason?: string;
}

export interface FileRenamedEvent extends ChronicleEventBase {
  type: 'FILE_RENAMED';
  oldPath: string;
  newPath: string;
  hash: string;
}

export interface FileSplitEvent extends ChronicleEventBase {
  type: 'FILE_SPLIT';
  originalPath: string;
  resultingPaths: string[];
  originalHash: string;
  strategy: string;
}

export interface FileMergedEvent extends ChronicleEventBase {
  type: 'FILE_MERGED';
  sourcePaths: string[];
  resultPath: string;
  resultHash: string;
  strategy: string;
}

// Union of all event types
export type ChronicleEvent = 
  | PlanDraftedEvent
  | PlanApprovedEvent
  | PlanDeniedEvent
  | PlanUnsafeEvent
  | HaltAndReportEvent
  | ReconciliationEvent
  | RogueEditDetectedEvent
  | BuildEvent
  | DeployEvent
  | EnvvarChangeEvent
  | PostmortemEvent
  | FileAddedEvent
  | FileRemovedEvent
  | FileRenamedEvent
  | FileSplitEvent
  | FileMergedEvent;