import { err, ErrorCodes, canonicalJSONStringify, sha256 } from '@sage/utils';
import type { ChroniclePath, ChronicleEvent } from './types.js';
import { readChronicleFile, tailChronicleFile } from './file-operations.js';
import { atomicAppendEvent } from './atomic-append.js';

// Path validation
export function validateChroniclePath(path: string): ChroniclePath {
  if (!path.endsWith('.sage')) {
    throw err(ErrorCodes.VALIDATION, `Chronicle path must end with .sage: ${path}`);
  }
  if (path.includes('..')) {
    throw err(ErrorCodes.VALIDATION, `Chronicle path cannot contain ..: ${path}`);
  }
  return path as ChroniclePath;
}

// Event ID computation
export async function computeEventId(event: ChronicleEvent): Promise<string> {
  // Create a copy without eventId for canonical hashing
  const { eventId, ...eventForHashing } = event;
  const canonical = canonicalJSONStringify(eventForHashing);
  return await sha256(canonical);
}

/**
 * Appends an event to a Chronicle, automatically computing its eventId.
 * This is the standard and recommended method for appending events.
 * @param path The path to the Chronicle file.
 * @param evt The event to append.
 * @param lockTimeoutMs The timeout for acquiring a file lock.
 */
export async function appendEvent(
  path: ChroniclePath,
  evt: ChronicleEvent,
  lockTimeoutMs: number = 2000
): Promise<void> {
  validateChroniclePath(path);
  validateEvent(evt);

  // Always compute the eventId to ensure correctness and idempotency.
  const eventToWrite = {
    ...evt,
    eventId: await computeEventId(evt),
  };

  await atomicAppendEvent(path, eventToWrite, lockTimeoutMs);
}

/**
 * Appends an event to a Chronicle using a pre-computed eventId.
 * This is an advanced method for use cases like event sourcing or testing.
 * The caller is responsible for ensuring the eventId is correct and canonical.
 * @param path The path to the Chronicle file.
 * @param evt The event to append. Must include a valid eventId.
 * @param lockTimeoutMs The timeout for acquiring a file lock.
 */
export async function appendEventWithId(
  path: ChroniclePath,
  evt: ChronicleEvent,
  lockTimeoutMs: number = 2000
): Promise<void> {
  validateChroniclePath(path);
  validateEvent(evt);

  if (!evt.eventId || typeof evt.eventId !== 'string') {
    throw err(ErrorCodes.VALIDATION, 'appendEventWithId requires a valid, pre-computed eventId on the event object.');
  }

  // Use the event as-is, trusting the provided eventId.
  await atomicAppendEvent(path, evt, lockTimeoutMs);
}

export async function readChronicle(path: ChroniclePath): Promise<ChronicleEvent[]> {
  validateChroniclePath(path);
  return await readChronicleFile(path);
}

export async function tailChronicle(
  path: ChroniclePath, 
  n: number = 10
): Promise<ChronicleEvent[]> {
  validateChroniclePath(path);
  
  if (n < 0) {
    throw err(ErrorCodes.VALIDATION, `Tail count must be non-negative: ${n}`);
  }
  
  return await tailChronicleFile(path, n);
}

// Event validation
function validateEvent(event: ChronicleEvent): void {
  if (!event.type || typeof event.type !== 'string') {
    throw err(ErrorCodes.VALIDATION, 'Event type is required and must be a string');
  }
  
  if (!event.timestamp || typeof event.timestamp !== 'string') {
    throw err(ErrorCodes.VALIDATION, 'Event timestamp is required and must be ISO8601 string');
  }
  
  if (!event.actor || typeof event.actor !== 'object') {
    throw err(ErrorCodes.VALIDATION, 'Event actor is required and must be an object');
  }
  
  if (!event.actor.agent || typeof event.actor.agent !== 'string') {
    throw err(ErrorCodes.VALIDATION, 'Event actor.agent is required and must be a string');
  }
  
  if (!event.actor.id || typeof event.actor.id !== 'string') {
    throw err(ErrorCodes.VALIDATION, 'Event actor.id is required and must be a string');
  }
  
  validateEventSpecificFields(event);
}

function validateEventSpecificFields(event: ChronicleEvent): void {
  switch (event.type) {
    case 'PLAN_DRAFTED':
      if (!event.planId || typeof event.planId !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'PLAN_DRAFTED event requires planId string');
      }
      if (!event.summary || typeof event.summary !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'PLAN_DRAFTED event requires summary string');
      }
      if (!Array.isArray(event.steps)) {
        throw err(ErrorCodes.VALIDATION, 'PLAN_DRAFTED event requires steps array');
      }
      break;
      
    case 'PLAN_APPROVED':
    case 'PLAN_DENIED':
      if (!event.planId || typeof event.planId !== 'string') {
        throw err(ErrorCodes.VALIDATION, `${event.type} event requires planId string`);
      }
      if (!event.reviewerId || typeof event.reviewerId !== 'string') {
        throw err(ErrorCodes.VALIDATION, `${event.type} event requires reviewerId string`);
      }
      break;
      
    case 'ROGUE_EDIT_DETECTED':
      if (!event.filePath || typeof event.filePath !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'ROGUE_EDIT_DETECTED event requires filePath string');
      }
      if (!event.hash || typeof event.hash !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'ROGUE_EDIT_DETECTED event requires hash string');
      }
      break;
      
    case 'FILE_ADDED':
      if (!(event as any).filePath || typeof (event as any).filePath !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'FILE_ADDED event requires filePath string');
      }
      break;
      
    case 'FILE_REMOVED':
      if (!(event as any).filePath || typeof (event as any).filePath !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'FILE_REMOVED event requires filePath string');
      }
      break;
      
    case 'FILE_RENAMED':
      if (!(event as any).oldPath || typeof (event as any).oldPath !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'FILE_RENAMED event requires oldPath string');
      }
      if (!(event as any).newPath || typeof (event as any).newPath !== 'string') {
        throw err(ErrorCodes.VALIDATION, 'FILE_RENAMED event requires newPath string');
      }
      break;
      
    default:
      break;
  }
}