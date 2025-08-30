import type { ChronicleEvent, ChroniclePath, Actor } from './types.js';
import { readChronicleFile } from './file-operations.js';
import { validateCausalChain, type ChainValidationResult } from './causal-chain.js';
import { findDuplicateEvents } from './canonicalization.js';
import { err, ErrorCodes, type ISO8601 } from '@sage/utils';

/**
 * Comprehensive analysis report for a Chronicle file.
 */
export interface ChronicleAnalysis {
  // Basic stats
  totalEvents: number;
  eventTypes: Record<string, number>;
  timeRange: { start: ISO8601; end: ISO8601 } | null;
  
  // Actor analysis
  actors: Record<string, { agent: string; eventCount: number; firstSeen: ISO8601; lastSeen: ISO8601 }>;
  
  // Integrity checks
  corruptedLines: number;
  duplicateEvents: number;
  causalChainIntegrity: ChainValidationResult;
  
  // Performance metrics
  avgEventSize: number;
  largestEvent: { index: number; size: number; type: string };
  
  // Event distribution over time
  eventsByHour: Record<string, number>; // ISO date hour -> count
  
  // Potential issues
  warnings: string[];
  errors: string[];
}

/**
 * Perform comprehensive analysis of a Chronicle file.
 */
export async function analyzeChronicle(chroniclePath: ChroniclePath): Promise<ChronicleAnalysis> {
  const events = await readChronicleFile(chroniclePath);
  
  const analysis: ChronicleAnalysis = {
    totalEvents: events.length,
    eventTypes: {},
    timeRange: null,
    actors: {},
    corruptedLines: 0,
    duplicateEvents: 0,
    causalChainIntegrity: await validateCausalChain(chroniclePath),
    avgEventSize: 0,
    largestEvent: { index: -1, size: 0, type: '' },
    eventsByHour: {},
    warnings: [],
    errors: []
  };
  
  if (events.length === 0) {
    analysis.warnings.push('Chronicle is empty');
    return analysis;
  }
  
  // Analyze events
  let totalSize = 0;
  const timestamps: string[] = [];
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Event type distribution
    analysis.eventTypes[event.type] = (analysis.eventTypes[event.type] || 0) + 1;
    
    // Event size analysis
    const eventSize = JSON.stringify(event).length;
    totalSize += eventSize;
    
    if (eventSize > analysis.largestEvent.size) {
      analysis.largestEvent = { index: i, size: eventSize, type: event.type };
    }
    
    // Actor analysis
    const actorKey = `${event.actor.agent}:${event.actor.id}`;
    if (!analysis.actors[actorKey]) {
      analysis.actors[actorKey] = {
        agent: event.actor.agent,
        eventCount: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      };
    }
    
    const actor = analysis.actors[actorKey];
    actor.eventCount++;
    if (event.timestamp < actor.firstSeen) actor.firstSeen = event.timestamp;
    if (event.timestamp > actor.lastSeen) actor.lastSeen = event.timestamp;
    
    // Time distribution
    timestamps.push(event.timestamp);
    const hourKey = event.timestamp.substring(0, 13); // YYYY-MM-DDTHH
    analysis.eventsByHour[hourKey] = (analysis.eventsByHour[hourKey] || 0) + 1;
  }
  
  // Calculate averages and ranges
  analysis.avgEventSize = totalSize / events.length;
  
  // Time range analysis
  const sortedTimestamps = timestamps.sort();
  if (sortedTimestamps.length > 0) {
    analysis.timeRange = {
      start: sortedTimestamps[0] as ISO8601,
      end: sortedTimestamps[sortedTimestamps.length - 1] as ISO8601
    };
  }
  
  // Find duplicates
  const duplicates = findDuplicateEvents(events);
  analysis.duplicateEvents = Array.from(duplicates.values())
    .reduce((sum, eventList) => sum + eventList.length - 1, 0); // -1 because first occurrence isn't a duplicate
  
  // Generate warnings and errors
  generateAnalysisWarnings(analysis);
  
  return analysis;
}

/**
 * Generate warnings and errors based on analysis results.
 */
function generateAnalysisWarnings(analysis: ChronicleAnalysis): void {
  // Causal chain issues
  if (!analysis.causalChainIntegrity.isValid) {
    analysis.errors.push(`Causal chain integrity compromised: ${analysis.causalChainIntegrity.brokenLinks.length} broken links`);
  }
  
  // Duplicate events
  if (analysis.duplicateEvents > 0) {
    analysis.warnings.push(`Found ${analysis.duplicateEvents} duplicate events`);
  }
  
  // Large events
  if (analysis.largestEvent.size > 10000) {
    analysis.warnings.push(`Large event detected: ${analysis.largestEvent.size} bytes at index ${analysis.largestEvent.index}`);
  }
  
  // Time gaps (simplified check)
  if (analysis.timeRange) {
    const start = new Date(analysis.timeRange.start);
    const end = new Date(analysis.timeRange.end);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    if (diffHours > 24 && analysis.totalEvents < 10) {
      analysis.warnings.push('Large time gap with few events - possible data loss');
    }
  }
  
  // Actor analysis
  const singleEventActors = Object.values(analysis.actors)
    .filter(actor => actor.eventCount === 1).length;
  
  if (singleEventActors > analysis.totalEvents * 0.8) {
    analysis.warnings.push('High number of single-event actors - possible ID generation issues');
  }
}

/**
 * Repair common issues in a Chronicle.
 */
export interface ChronicleRepairOptions {
  removeDuplicates?: boolean;
  fixTimestampOrder?: boolean;
  repairCausalChain?: boolean;
  createBackup?: boolean;
}

export interface ChronicleRepairResult {
  repaired: boolean;
  backupPath?: string;
  changesApplied: string[];
  warnings: string[];
}

/**
 * Attempt to repair common Chronicle issues.
 */
export async function repairChronicle(
  chroniclePath: ChroniclePath,
  options: ChronicleRepairOptions = {}
): Promise<ChronicleRepairResult> {
  const result: ChronicleRepairResult = {
    repaired: false,
    changesApplied: [],
    warnings: []
  };
  
  // Create backup if requested
  if (options.createBackup) {
    const backupPath = `${chroniclePath}.backup.${Date.now()}`;
    try {
      const fs = await import('fs/promises');
      await fs.copyFile(chroniclePath, backupPath);
      result.backupPath = backupPath;
    } catch (error) {
      result.warnings.push('Failed to create backup');
    }
  }
  
  let events = await readChronicleFile(chroniclePath);
  let modified = false;
  
  // Remove duplicates
  if (options.removeDuplicates) {
    const originalCount = events.length;
    const seen = new Set<string>();
    events = events.filter(event => {
      if (!event.eventId) return true;
      if (seen.has(event.eventId)) {
        return false; // Remove duplicate
      }
      seen.add(event.eventId);
      return true;
    });
    
    if (events.length < originalCount) {
      result.changesApplied.push(`Removed ${originalCount - events.length} duplicate events`);
      modified = true;
    }
  }
  
  // Fix timestamp order
  if (options.fixTimestampOrder) {
    const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const isOrdered = events.every((event, i) => event.timestamp === sortedEvents[i].timestamp);
    
    if (!isOrdered) {
      events = sortedEvents;
      result.changesApplied.push('Reordered events by timestamp');
      modified = true;
    }
  }
  
  // Write repaired Chronicle if changes were made
  if (modified) {
    try {
      const fs = await import('fs/promises');
      const content = events.map(event => JSON.stringify(event)).join('\n') + '\n';
      await fs.writeFile(chroniclePath, content, 'utf-8');
      result.repaired = true;
    } catch (error) {
      throw err(ErrorCodes.IO, `Failed to write repaired Chronicle to ${chroniclePath}`, error);
    }
  }
  
  return result;
}

/**
 * Generate a summary report of Chronicle analysis.
 */
export function formatAnalysisReport(analysis: ChronicleAnalysis): string {
  const lines: string[] = [];
  
  lines.push('=== Chronicle Analysis Report ===');
  lines.push(`Total Events: ${analysis.totalEvents}`);
  
  if (analysis.timeRange) {
    lines.push(`Time Range: ${analysis.timeRange.start} to ${analysis.timeRange.end}`);
  }
  
  lines.push(`Actors: ${Object.keys(analysis.actors).length}`);
  lines.push(`Event Types: ${Object.keys(analysis.eventTypes).length}`);
  
  lines.push('\n--- Event Type Distribution ---');
  for (const [type, count] of Object.entries(analysis.eventTypes)) {
    lines.push(`  ${type}: ${count}`);
  }
  
  lines.push('\n--- Top Actors ---');
  const topActors = Object.entries(analysis.actors)
    .sort(([,a], [,b]) => b.eventCount - a.eventCount)
    .slice(0, 5);
  
  for (const [key, actor] of topActors) {
    lines.push(`  ${key}: ${actor.eventCount} events`);
  }
  
  if (analysis.causalChainIntegrity.chainedEvents > 0) {
    lines.push(`\n--- Causal Chain ---`);
    lines.push(`Chained Events: ${analysis.causalChainIntegrity.chainedEvents}/${analysis.totalEvents}`);
    lines.push(`Chain Integrity: ${analysis.causalChainIntegrity.isValid ? 'Valid' : 'BROKEN'}`);
  }
  
  if (analysis.warnings.length > 0) {
    lines.push('\n--- Warnings ---');
    for (const warning of analysis.warnings) {
      lines.push(`  ⚠️  ${warning}`);
    }
  }
  
  if (analysis.errors.length > 0) {
    lines.push('\n--- Errors ---');
    for (const error of analysis.errors) {
      lines.push(`  ❌ ${error}`);
    }
  }
  
  return lines.join('\n');
}