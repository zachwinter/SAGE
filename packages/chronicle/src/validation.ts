import type { ChronicleEvent } from './types.js';

// Type guards for event discrimination
export function isPlanDraftedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'PLAN_DRAFTED' } {
  return event.type === 'PLAN_DRAFTED' && 
         'planId' in event && 
         'summary' in event && 
         'steps' in event;
}

export function isPlanApprovedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'PLAN_APPROVED' } {
  return event.type === 'PLAN_APPROVED' && 
         'planId' in event && 
         'reviewerId' in event && 
         'justification' in event;
}

export function isPlanDeniedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'PLAN_DENIED' } {
  return event.type === 'PLAN_DENIED' && 
         'planId' in event && 
         'reviewerId' in event && 
         'reason' in event;
}

export function isPlanUnsafeEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'PLAN_UNSAFE' } {
  return event.type === 'PLAN_UNSAFE' && 
         'planId' in event && 
         'forcedBy' in event && 
         'overriddenWarnings' in event;
}

export function isHaltAndReportEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'HALT_AND_REPORT' } {
  return event.type === 'HALT_AND_REPORT' && 
         'invariant' in event && 
         'expected' in event && 
         'actual' in event;
}

export function isReconciliationEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'RECONCILIATION' } {
  return event.type === 'RECONCILIATION' && 
         'filePath' in event && 
         'diffRef' in event && 
         'reconciliationStrategy' in event;
}

export function isRogueEditDetectedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'ROGUE_EDIT_DETECTED' } {
  return event.type === 'ROGUE_EDIT_DETECTED' && 
         'filePath' in event && 
         'hash' in event && 
         'detectedBy' in event;
}

export function isBuildEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'BUILD' } {
  return event.type === 'BUILD' && 
         'status' in event;
}

export function isDeployEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'DEPLOY' } {
  return event.type === 'DEPLOY' && 
         'environment' in event && 
         'deploymentId' in event && 
         'status' in event;
}

export function isEnvvarChangeEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'ENVVAR_CHANGE' } {
  return event.type === 'ENVVAR_CHANGE' && 
         'variable' in event && 
         'environment' in event && 
         'operation' in event;
}

export function isPostmortemEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'POSTMORTEM' } {
  return event.type === 'POSTMORTEM' && 
         'incidentId' in event && 
         'title' in event && 
         'rootCause' in event && 
         'actionItems' in event;
}

export function isFileAddedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'FILE_ADDED' } {
  return event.type === 'FILE_ADDED' && 
         'filePath' in event && 
         'hash' in event && 
         'size' in event;
}

export function isFileRemovedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'FILE_REMOVED' } {
  return event.type === 'FILE_REMOVED' && 
         'filePath' in event && 
         'lastHash' in event;
}

export function isFileRenamedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'FILE_RENAMED' } {
  return event.type === 'FILE_RENAMED' && 
         'oldPath' in event && 
         'newPath' in event && 
         'hash' in event;
}

export function isFileSplitEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'FILE_SPLIT' } {
  return event.type === 'FILE_SPLIT' && 
         'originalPath' in event && 
         'resultingPaths' in event && 
         'originalHash' in event && 
         'strategy' in event;
}

export function isFileMergedEvent(event: ChronicleEvent): event is ChronicleEvent & { type: 'FILE_MERGED' } {
  return event.type === 'FILE_MERGED' && 
         'sourcePaths' in event && 
         'resultPath' in event && 
         'resultHash' in event && 
         'strategy' in event;
}

// Utility function to get event type in a type-safe way
export function getEventType<T extends ChronicleEvent>(event: T): T['type'] {
  return event.type;
}

// Filter events by type with proper type inference
export function filterEventsByType<K extends ChronicleEvent['type']>(
  events: ChronicleEvent[],
  type: K
): Array<Extract<ChronicleEvent, { type: K }>> {
  return events.filter(event => event.type === type) as Array<Extract<ChronicleEvent, { type: K }>>;
}

// Check if event has specific fields (useful for runtime validation)
export function hasEventFields<T extends ChronicleEvent>(
  event: ChronicleEvent,
  fields: Array<keyof T>
): event is T {
  return fields.every(field => field in event);
}