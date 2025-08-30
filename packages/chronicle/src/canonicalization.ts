import { canonicalJSONStringify, sha256 } from '@sage/utils';
import type { ChronicleEvent } from './types.js';

/**
 * Fields that should be excluded from event ID computation.
 * These are fields that are either computed or metadata that shouldn't affect identity.
 */
const EXCLUDED_FIELDS = new Set([
  'eventId',     // The ID itself - creates circular dependency
  // Note: We include all other fields including metadata like planHash, graphCommit, etc.
  // since they contribute to the event's semantic identity
]);

/**
 * Create a canonical representation of an event for ID computation.
 * Excludes fields that should not participate in identity hashing.
 */
export function canonicalizeEvent(event: ChronicleEvent): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};
  
  // Include all fields except excluded ones
  for (const [key, value] of Object.entries(event)) {
    if (!EXCLUDED_FIELDS.has(key)) {
      canonical[key] = value;
    }
  }
  
  return canonical;
}

/**
 * Compute the event ID for a Chronicle event.
 * Uses canonical JSON serialization + SHA-256 for deterministic hashing.
 */
export async function computeEventId(event: ChronicleEvent): Promise<string> {
  const canonical = canonicalizeEvent(event);
  const canonicalJson = canonicalJSONStringify(canonical);
  return await sha256(canonicalJson);
}

/**
 * Verify that an event's ID matches its computed ID.
 * Useful for validation and integrity checking.
 */
export async function verifyEventId(event: ChronicleEvent): Promise<boolean> {
  if (!event.eventId) {
    return false; // No ID to verify
  }
  
  const computedId = await computeEventId(event);
  return event.eventId === computedId;
}

/**
 * Compute event IDs for multiple events in batch.
 * More efficient than computing one by one.
 */
export async function computeEventIds(events: ChronicleEvent[]): Promise<string[]> {
  return Promise.all(events.map(computeEventId));
}

/**
 * Create a deterministic hash of multiple events together.
 * Useful for Chronicle integrity checking or creating compound IDs.
 */
export async function computeChronicleHash(events: ChronicleEvent[]): Promise<string> {
  // Sort events by timestamp to ensure deterministic ordering
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  // Create canonical representation of all events
  const canonicalEvents = sortedEvents.map(canonicalizeEvent);
  const canonicalJson = canonicalJSONStringify(canonicalEvents);
  
  return await sha256(canonicalJson);
}

/**
 * Check if two events are semantically identical (would have same ID).
 * More efficient than computing IDs since it uses canonical JSON comparison.
 */
export function eventsAreIdentical(event1: ChronicleEvent, event2: ChronicleEvent): boolean {
  const canonical1 = canonicalizeEvent(event1);
  const canonical2 = canonicalizeEvent(event2);
  
  return canonicalJSONStringify(canonical1) === canonicalJSONStringify(canonical2);
}

/**
 * Find duplicate events in a list based on their canonical representation.
 * Returns map of canonical JSON -> list of events with that representation.
 */
export function findDuplicateEvents(events: ChronicleEvent[]): Map<string, ChronicleEvent[]> {
  const groups = new Map<string, ChronicleEvent[]>();
  
  for (const event of events) {
    const canonical = canonicalizeEvent(event);
    const canonicalJson = canonicalJSONStringify(canonical);
    
    if (!groups.has(canonicalJson)) {
      groups.set(canonicalJson, []);
    }
    groups.get(canonicalJson)!.push(event);
  }
  
  // Return only groups with more than one event (duplicates)
  const duplicates = new Map<string, ChronicleEvent[]>();
  for (const [canonical, eventList] of groups) {
    if (eventList.length > 1) {
      duplicates.set(canonical, eventList);
    }
  }
  
  return duplicates;
}