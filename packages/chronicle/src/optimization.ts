import fs from 'fs/promises';
import type { ChronicleEvent, ChroniclePath } from './types.js';
import { fileExists } from './file-operations.js';

/**
 * Efficient duplicate detection that doesn't require loading the entire Chronicle.
 * Uses a sliding window approach to check recent events for duplicates.
 */

interface DuplicateCheckOptions {
  windowSize?: number; // How many recent events to check (default: 100)
  useIndex?: boolean;  // Whether to use an index file for faster lookups (default: false)
}

/**
 * Check if an event ID already exists in the Chronicle without loading all events.
 * Uses a sliding window approach for efficiency.
 */
export async function isDuplicateEvent(
  chroniclePath: ChroniclePath,
  eventId: string,
  options: DuplicateCheckOptions = {}
): Promise<boolean> {
  const { windowSize = 100 } = options;
  
  if (!await fileExists(chroniclePath)) {
    return false;
  }
  
  try {
    // Read only the end of the file to check recent events
    const content = await readFileEnd(chroniclePath, windowSize);
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ChronicleEvent;
        if (event.eventId === eventId) {
          return true;
        }
      } catch {
        // Skip corrupted lines
        continue;
      }
    }
    
    return false;
  } catch (error) {
    // If we can't read the file, assume no duplicate
    console.warn(`Could not check for duplicate in ${chroniclePath}:`, error);
    return false;
  }
}

/**
 * Read approximately the last N lines from a file efficiently.
 * This is a simplified implementation - production might use more sophisticated approaches.
 */
async function readFileEnd(filePath: string, maxLines: number): Promise<string> {
  const stats = await fs.stat(filePath);
  const fileSize = stats.size;
  
  // If file is small, read the whole thing
  if (fileSize < 10000) {
    return await fs.readFile(filePath, 'utf-8');
  }
  
  // Estimate bytes needed (rough estimate: 200 bytes per line)
  const estimatedBytes = maxLines * 200;
  const startPos = Math.max(0, fileSize - estimatedBytes);
  
  // Read from estimated position to end
  const buffer = Buffer.alloc(estimatedBytes);
  const fd = await fs.open(filePath, 'r');
  
  try {
    const { bytesRead } = await fd.read(buffer, 0, estimatedBytes, startPos);
    const content = buffer.subarray(0, bytesRead).toString('utf-8');
    
    // Find the first complete line (skip partial line at beginning)
    const firstNewline = content.indexOf('\n');
    return firstNewline === -1 ? content : content.substring(firstNewline + 1);
  } finally {
    await fd.close();
  }
}

/**
 * Create and maintain an index file for fast event ID lookups.
 * Index format: one event ID per line, in append order.
 */
export async function maintainEventIndex(chroniclePath: ChroniclePath): Promise<void> {
  const indexPath = `${chroniclePath}.idx`;
  
  // Check if index exists and is up to date
  if (await fileExists(indexPath)) {
    const [chronicleStats, indexStats] = await Promise.all([
      fs.stat(chroniclePath).catch(() => null),
      fs.stat(indexPath).catch(() => null)
    ]);
    
    // If index is newer than Chronicle, assume it's up to date
    if (chronicleStats && indexStats && indexStats.mtime >= chronicleStats.mtime) {
      return;
    }
  }
  
  // Rebuild index from scratch
  await rebuildEventIndex(chroniclePath);
}

/**
 * Rebuild the event index file from the Chronicle.
 */
async function rebuildEventIndex(chroniclePath: ChroniclePath): Promise<void> {
  const indexPath = `${chroniclePath}.idx`;
  
  if (!await fileExists(chroniclePath)) {
    return;
  }
  
  try {
    const content = await fs.readFile(chroniclePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const eventIds: string[] = [];
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ChronicleEvent;
        if (event.eventId) {
          eventIds.push(event.eventId);
        }
      } catch {
        // Skip corrupted lines
        continue;
      }
    }
    
    // Write index file
    await fs.writeFile(indexPath, eventIds.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.warn(`Failed to rebuild index for ${chroniclePath}:`, error);
  }
}

/**
 * Check for duplicate using the index file if available.
 */
export async function isDuplicateUsingIndex(
  chroniclePath: ChroniclePath,
  eventId: string
): Promise<boolean> {
  const indexPath = `${chroniclePath}.idx`;
  
  if (!await fileExists(indexPath)) {
    // Fallback to regular duplicate check
    return isDuplicateEvent(chroniclePath, eventId);
  }
  
  try {
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    return indexContent.includes(eventId);
  } catch {
    // Fallback to regular duplicate check
    return isDuplicateEvent(chroniclePath, eventId);
  }
}

/**
 * Batch process multiple events for duplicate checking.
 * More efficient than checking one by one.
 */
export async function batchCheckDuplicates(
  chroniclePath: ChroniclePath,
  eventIds: string[],
  options: DuplicateCheckOptions = {}
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  if (eventIds.length === 0) {
    return results;
  }
  
  // Initialize all as non-duplicates
  for (const eventId of eventIds) {
    results.set(eventId, false);
  }
  
  if (!await fileExists(chroniclePath)) {
    return results;
  }
  
  try {
    const { windowSize = 100, useIndex = false } = options;
    
    if (useIndex) {
      // Use index-based checking
      const indexPath = `${chroniclePath}.idx`;
      if (await fileExists(indexPath)) {
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        const indexLines = new Set(indexContent.split('\n').filter(line => line.trim()));
        
        for (const eventId of eventIds) {
          results.set(eventId, indexLines.has(eventId));
        }
        return results;
      }
    }
    
    // Fallback to sliding window approach
    const content = await readFileEnd(chroniclePath, windowSize);
    const lines = content.split('\n').filter(line => line.trim());
    const existingIds = new Set<string>();
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ChronicleEvent;
        if (event.eventId) {
          existingIds.add(event.eventId);
        }
      } catch {
        continue;
      }
    }
    
    for (const eventId of eventIds) {
      results.set(eventId, existingIds.has(eventId));
    }
    
  } catch (error) {
    console.warn(`Batch duplicate check failed for ${chroniclePath}:`, error);
  }
  
  return results;
}