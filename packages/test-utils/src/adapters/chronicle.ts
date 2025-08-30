import { createHash } from "crypto";
import type { ChronicleAdapter } from "./types.js";

interface ChronicleEvent {
  type: string;
  eventId: string;
  timestamp: string;
  actor?: { agent: string; id: string };
  [key: string]: any;
}

/**
 * In-memory Chronicle adapter with append-only semantics
 */
export class TestChronicleAdapter implements ChronicleAdapter {
  private chronicles = new Map<string, ChronicleEvent[]>();
  private clock: { now(): string };

  constructor(options: { clock?: { now(): string } } = {}) {
    this.clock = options.clock || { now: () => new Date().toISOString() };
  }

  async read(path: string): Promise<any[]> {
    const events = this.chronicles.get(path) || [];
    // Return deep copy to prevent external mutation
    return events.map(event => ({ ...event }));
  }

  async append(path: string, evt: any): Promise<void> {
    // Validate event structure
    if (!evt.type || typeof evt.type !== 'string') {
      throw new Error('EVALIDATION: Event must have a string type field');
    }

    // Create complete event with metadata
    const timestamp = this.clock.now();
    const eventWithMeta = {
      ...evt,
      timestamp: evt.timestamp || timestamp,
    };

    // Compute eventId if not provided (idempotent append)
    let eventId = evt.eventId;
    if (!eventId) {
      eventId = this.computeEventId(eventWithMeta);
      eventWithMeta.eventId = eventId;
    }

    // Get or create chronicle
    let chronicle = this.chronicles.get(path);
    if (!chronicle) {
      chronicle = [];
      this.chronicles.set(path, chronicle);
    }

    // Check for duplicate eventId (idempotent append)
    const existingEvent = chronicle.find(e => e.eventId === eventId);
    if (existingEvent) {
      // Idempotent - already exists, do nothing
      return;
    }

    // Append new event (maintain ordering)
    chronicle.push(eventWithMeta as ChronicleEvent);
  }

  /**
   * Compute deterministic eventId from event content
   */
  private computeEventId(event: any): string {
    // Create canonical JSON representation
    const canonical = this.canonicalizeEvent(event);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Create canonical JSON for consistent hashing
   */
  private canonicalizeEvent(event: any): string {
    // Remove eventId from hash computation to avoid circular dependency
    const { eventId, ...hashableEvent } = event;
    
    // Sort keys recursively for deterministic JSON
    const sortedEvent = this.sortKeys(hashableEvent);
    return JSON.stringify(sortedEvent);
  }

  /**
   * Recursively sort object keys for canonical representation
   */
  private sortKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortKeys(item));
    }
    
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = this.sortKeys(obj[key]);
    }
    return sorted;
  }

  /**
   * Get all chronicle paths (testing utility)
   */
  getAllPaths(): string[] {
    return Array.from(this.chronicles.keys());
  }

  /**
   * Get event count for a path (testing utility)
   */
  getEventCount(path: string): number {
    const chronicle = this.chronicles.get(path);
    return chronicle ? chronicle.length : 0;
  }

  /**
   * Clear all chronicles (testing utility)
   */
  clear(): void {
    this.chronicles.clear();
  }

  /**
   * Find events matching a pattern (testing utility)
   */
  async findEvents(path: string, pattern: Partial<ChronicleEvent>): Promise<ChronicleEvent[]> {
    const events = await this.read(path);
    return events.filter(event => {
      return Object.entries(pattern).every(([key, value]) => 
        event[key] === value
      );
    });
  }

  /**
   * Tail events from a chronicle (streaming utility)
   */
  async *tail(path: string, fromIndex: number = 0): AsyncGenerator<ChronicleEvent> {
    const events = this.chronicles.get(path) || [];
    for (let i = fromIndex; i < events.length; i++) {
      yield { ...events[i] };
    }
  }
}

/**
 * Factory function matching CONTRACT.md specification
 */
export function makeChronicle(options: { 
  clock?: { now(): string } 
} = {}): ChronicleAdapter {
  return new TestChronicleAdapter(options);
}