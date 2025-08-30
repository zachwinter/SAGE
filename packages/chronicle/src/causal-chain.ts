import type { ChronicleEvent, ChroniclePath } from './types.js';
import { readChronicleFile } from './file-operations.js';
import { err, ErrorCodes } from '@sage/utils';

/**
 * Chain link representing an event and its position in the causal chain.
 */
export interface ChainLink {
  event: ChronicleEvent;
  index: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Result of chain validation with details about any issues found.
 */
export interface ChainValidationResult {
  isValid: boolean;
  totalEvents: number;
  chainedEvents: number;
  brokenLinks: Array<{
    eventIndex: number;
    eventId: string;
    issue: 'missing_prev' | 'invalid_prev' | 'circular_reference';
    details: string;
  }>;
  orphanedEvents: string[]; // Events with prevEventId but no corresponding event
}

/**
 * Build causal chains by linking events with prevEventId references.
 * Returns events with their causal chain positions.
 */
export async function buildCausalChain(chroniclePath: ChroniclePath): Promise<ChainLink[]> {
  const events = await readChronicleFile(chroniclePath);
  const eventMap = new Map<string, { event: ChronicleEvent; index: number }>();
  
  // Index all events by their ID
  events.forEach((event, index) => {
    if (event.eventId) {
      eventMap.set(event.eventId, { event, index });
    }
  });
  
  // Build chain links
  const chainLinks: ChainLink[] = [];
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Check if this event has a previous event
    const hasPrev = event.prevEventId ? eventMap.has(event.prevEventId) : false;
    
    // Check if any other event references this as previous
    const hasNext = event.eventId ? 
      events.some(e => e.prevEventId === event.eventId) : 
      false;
    
    chainLinks.push({
      event,
      index: i,
      hasNext,
      hasPrev
    });
  }
  
  return chainLinks;
}

/**
 * Validate the integrity of causal chains in a Chronicle.
 * Detects broken links, circular references, and orphaned events.
 */
export async function validateCausalChain(chroniclePath: ChroniclePath): Promise<ChainValidationResult> {
  const events = await readChronicleFile(chroniclePath);
  const eventMap = new Map<string, number>(); // eventId -> index
  const brokenLinks: ChainValidationResult['brokenLinks'] = [];
  const orphanedEvents: string[] = [];
  let chainedEvents = 0;
  
  // Index all events
  events.forEach((event, index) => {
    if (event.eventId) {
      eventMap.set(event.eventId, index);
    }
  });
  
  // Validate each event's causal links
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    if (!event.eventId) continue;
    
    if (event.prevEventId) {
      chainedEvents++;
      
      // Check if referenced previous event exists
      if (!eventMap.has(event.prevEventId)) {
        orphanedEvents.push(event.eventId);
        brokenLinks.push({
          eventIndex: i,
          eventId: event.eventId,
          issue: 'missing_prev',
          details: `References non-existent previous event: ${event.prevEventId}`
        });
        continue;
      }
      
      // Check for circular references
      if (event.prevEventId === event.eventId) {
        brokenLinks.push({
          eventIndex: i,
          eventId: event.eventId,
          issue: 'circular_reference',
          details: 'Event references itself as previous event'
        });
        continue;
      }
      
      // Check for temporal consistency (prev event should come before current)
      const prevIndex = eventMap.get(event.prevEventId)!;
      if (prevIndex >= i) {
        brokenLinks.push({
          eventIndex: i,
          eventId: event.eventId,
          issue: 'invalid_prev',
          details: `Previous event (index ${prevIndex}) comes after current event (index ${i})`
        });
      }
    }
  }
  
  return {
    isValid: brokenLinks.length === 0 && orphanedEvents.length === 0,
    totalEvents: events.length,
    chainedEvents,
    brokenLinks,
    orphanedEvents
  };
}

/**
 * Find all events in a causal chain starting from a specific event.
 * Traverses forward and backward to get the complete chain.
 */
export async function getCompleteChain(
  chroniclePath: ChroniclePath, 
  startEventId: string
): Promise<ChronicleEvent[]> {
  const events = await readChronicleFile(chroniclePath);
  const eventMap = new Map<string, ChronicleEvent>();
  
  // Index events by ID
  events.forEach(event => {
    if (event.eventId) {
      eventMap.set(event.eventId, event);
    }
  });
  
  if (!eventMap.has(startEventId)) {
    throw err(ErrorCodes.VALIDATION, `Event ${startEventId} not found in Chronicle`);
  }
  
  const chainEvents = new Set<string>();
  const result: ChronicleEvent[] = [];
  
  // Traverse backwards to find chain start
  let current = startEventId;
  const backwards: ChronicleEvent[] = [];
  
  while (current && eventMap.has(current) && !chainEvents.has(current)) {
    const event = eventMap.get(current)!;
    chainEvents.add(current);
    backwards.unshift(event); // Add to beginning
    current = event.prevEventId || '';
  }
  
  result.push(...backwards);
  
  // Traverse forwards from start event to find chain end
  const forwards: ChronicleEvent[] = [];
  const startEvent = eventMap.get(startEventId)!;
  
  // Find events that reference our chain events
  for (const event of events) {
    if (event.prevEventId && chainEvents.has(event.prevEventId) && !chainEvents.has(event.eventId!)) {
      forwards.push(event);
      chainEvents.add(event.eventId!);
    }
  }
  
  // Sort forward events by their causal order
  forwards.sort((a, b) => {
    // This is a simplified sort - in production you'd want more sophisticated topological sorting
    return a.timestamp.localeCompare(b.timestamp);
  });
  
  result.push(...forwards);
  
  return result;
}

/**
 * Get the next event ID to use for prevEventId when appending to a Chronicle.
 * Returns the eventId of the most recent event, or undefined if Chronicle is empty.
 */
export async function getChainTail(chroniclePath: ChroniclePath): Promise<string | undefined> {
  const events = await readChronicleFile(chroniclePath);
  
  if (events.length === 0) {
    return undefined;
  }
  
  // Return the eventId of the last event
  const lastEvent = events[events.length - 1];
  return lastEvent.eventId;
}

/**
 * Append an event to a Chronicle with automatic causal chaining.
 * Sets prevEventId to the last event's ID if not already specified.
 */
export async function appendWithCausalChain(
  chroniclePath: ChroniclePath,
  event: ChronicleEvent,
  options?: { forcePrevEventId?: string }
): Promise<ChronicleEvent> {
  // If prevEventId not specified and no force override, use chain tail
  if (!event.prevEventId && !options?.forcePrevEventId) {
    const chainTail = await getChainTail(chroniclePath);
    if (chainTail) {
      event.prevEventId = chainTail;
    }
  } else if (options?.forcePrevEventId) {
    event.prevEventId = options.forcePrevEventId;
  }
  
  return event;
}