import fs from 'fs/promises';
import path from 'path';
import { err, ErrorCodes } from '@sage/utils';
import type { ChronicleEvent, ChroniclePath } from './types.js';

/**
 * Read and parse a Chronicle file (NDJSON format).
 * Gracefully handles corrupt/partial lines by skipping them.
 */
export async function readChronicleFile(chroniclePath: ChroniclePath): Promise<ChronicleEvent[]> {
  try {
    const content = await fs.readFile(chroniclePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const events: ChronicleEvent[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const event = JSON.parse(line) as ChronicleEvent;
        events.push(event);
      } catch (parseError) {
        // Skip corrupted/partial lines but warn about them
        console.warn(`Chronicle ${chroniclePath}:${i + 1}: Skipping corrupted line: ${parseError}`);
        continue;
      }
    }
    
    return events;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty array
      return [];
    }
    
    // Other I/O errors
    throw err(ErrorCodes.IO, `Failed to read chronicle ${chroniclePath}`, error);
  }
}

/**
 * Get the last N events from a Chronicle file without loading the entire file.
 * This is a simplified implementation - in production you might want to read backwards.
 */
export async function tailChronicleFile(chroniclePath: ChroniclePath, n: number): Promise<ChronicleEvent[]> {
  const allEvents = await readChronicleFile(chroniclePath);
  return allEvents.slice(-n);
}

/**
 * Ensure the directory exists for a Chronicle file path.
 */
export async function ensureChronicleDirectory(chroniclePath: ChroniclePath): Promise<void> {
  const directory = path.dirname(chroniclePath);
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch (error) {
    throw err(ErrorCodes.IO, `Failed to create directory for ${chroniclePath}`, error);
  }
}

/**
 * Serialize an event to NDJSON format (single line).
 */
export function serializeEvent(event: ChronicleEvent): string {
  return JSON.stringify(event) + '\n';
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}