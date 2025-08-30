import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { err, ErrorCodes } from '@sage/utils';
import type { ChronicleEvent, ChroniclePath } from './types.js';
import { acquireLock, cleanStaleLocks } from './file-locking.js';
import { ensureChronicleDirectory, serializeEvent, fileExists } from './file-operations.js';

/**
 * Atomically append an event to a Chronicle file with proper concurrency control.
 * Uses file locking and atomic write operations to ensure data integrity.
 */
export async function atomicAppendEvent(
  chroniclePath: ChroniclePath,
  event: ChronicleEvent,
  lockTimeoutMs: number = 2000
): Promise<void> {
  // Clean up any stale locks first
  await cleanStaleLocks(chroniclePath);
  
  // Acquire exclusive lock
  const lock = await acquireLock(chroniclePath, lockTimeoutMs);
  
  try {
    // Ensure directory exists
    await ensureChronicleDirectory(chroniclePath);
    
    // Check if event already exists (idempotency check)
    if (event.eventId && await eventExists(chroniclePath, event.eventId)) {
      console.log(`Event ${event.eventId} already exists in ${chroniclePath}, skipping`);
      return;
    }
    
    // Serialize event to NDJSON
    const eventData = serializeEvent(event);
    
    // Use atomic append operation
    await atomicWriteAppend(chroniclePath, eventData);
    
  } finally {
    // Always release the lock
    await lock.release();
  }
}

/**
 * Check if an event with the given ID already exists in the Chronicle.
 * This is used for idempotency - we read the last few events to check for duplicates.
 */
async function eventExists(chroniclePath: ChroniclePath, eventId: string): Promise<boolean> {
  if (!await fileExists(chroniclePath)) {
    return false;
  }
  
  try {
    // For performance, we only check the last 100 events for duplicates
    // In production, you might want a more sophisticated approach
    const content = await fs.promises.readFile(chroniclePath, 'utf-8');
    const lines = content.trim().split('\n').slice(-100);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
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
    // If we can't read the file, assume event doesn't exist
    console.warn(`Could not check for duplicate event in ${chroniclePath}:`, error);
    return false;
  }
}

/**
 * Atomically append data to a file using the write-to-temp-then-rename pattern.
 * This ensures that either the entire append succeeds or fails completely.
 */
async function atomicWriteAppend(filePath: string, data: string): Promise<void> {
  const tempPath = generateTempPath(filePath);
  
  try {
    const fileExisted = await fileExists(filePath);
    
    if (fileExisted) {
      // Copy existing file to temp location
      await fs.promises.copyFile(filePath, tempPath);
    }
    
    // Append new data to temp file
    await fs.promises.appendFile(tempPath, data, 'utf-8');
    
    // Sync to disk to ensure durability
    const fd = await fs.promises.open(tempPath, 'r+');
    await fd.sync();
    await fd.close();
    
    // Atomically replace original file with temp file
    await fs.promises.rename(tempPath, filePath);
    
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    
    throw err(ErrorCodes.IO, `Failed to append to ${filePath}`, error);
  }
}

/**
 * Generate a unique temporary file path for atomic operations.
 */
function generateTempPath(originalPath: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  const random = crypto.randomBytes(8).toString('hex');
  const pid = process.pid;
  
  return path.join(dir, `${base}.tmp.${pid}.${random}${ext}`);
}

/**
 * Deduplicate consecutive events with the same eventId.
 * This can be used as a cleanup operation or during reads.
 */
export async function deduplicateConsecutiveEvents(chroniclePath: ChroniclePath): Promise<number> {
  const content = await fs.promises.readFile(chroniclePath, 'utf-8');
  const lines = content.split('\n');
  const dedupedLines: string[] = [];
  let lastEventId: string | null = null;
  let duplicatesRemoved = 0;
  
  for (const line of lines) {
    if (!line.trim()) {
      dedupedLines.push(line);
      continue;
    }
    
    try {
      const event = JSON.parse(line);
      const eventId = event.eventId;
      
      if (eventId && eventId === lastEventId) {
        // Skip duplicate
        duplicatesRemoved++;
        continue;
      }
      
      dedupedLines.push(line);
      lastEventId = eventId;
    } catch {
      // Keep corrupted lines as-is
      dedupedLines.push(line);
      lastEventId = null;
    }
  }
  
  if (duplicatesRemoved > 0) {
    // Write deduplicated content back
    await fs.promises.writeFile(chroniclePath, dedupedLines.join('\n'), 'utf-8');
  }
  
  return duplicatesRemoved;
}