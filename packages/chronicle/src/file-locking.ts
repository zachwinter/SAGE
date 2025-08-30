import fs from 'fs';
import path from 'path';
import { err, ErrorCodes } from '@sage/utils';

/**
 * Cross-platform file locking implementation.
 * Uses Node.js fs.open with exclusive flags for atomic locking.
 */

interface FileLock {
  fd: number;
  path: string;
  release(): Promise<void>;
}

/**
 * Acquire an exclusive lock on a file for the specified timeout.
 * Creates a .lock file to coordinate between processes.
 */
export async function acquireLock(filePath: string, timeoutMs: number): Promise<FileLock> {
  const lockPath = `${filePath}.lock`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try to create an exclusive lock file
      // O_CREAT | O_EXCL | O_WRONLY = create exclusively, fail if exists
      const fd = await fs.promises.open(lockPath, 'wx');
      
      // Write our PID to the lock file for debugging
      await fs.promises.writeFile(fd, `${process.pid}\n${Date.now()}\n`);
      
      return {
        fd: fd.fd,
        path: lockPath,
        async release() {
          try {
            await fd.close();
            await fs.promises.unlink(lockPath);
          } catch (error) {
            // Log but don't throw - releasing is best effort
            console.warn(`Failed to release lock ${lockPath}:`, error);
          }
        }
      };
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Lock file exists, check if it's stale
        const isStale = await isLockStale(lockPath);
        if (isStale) {
          // Remove stale lock and try again
          try {
            await fs.promises.unlink(lockPath);
            continue;
          } catch {
            // If we can't remove it, keep waiting
          }
        }
        
        // Wait a bit before retrying
        await sleep(10);
        continue;
      } else {
        throw err(ErrorCodes.IO, `Failed to acquire lock for ${filePath}`, error);
      }
    }
  }
  
  // Timeout exceeded
  throw err(ErrorCodes.LOCK_TIMEOUT, `Could not acquire lock for ${filePath} within ${timeoutMs}ms`);
}

/**
 * Check if a lock file is stale (process no longer exists).
 */
async function isLockStale(lockPath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(lockPath, 'utf-8');
    const lines = content.trim().split('\n');
    const pid = parseInt(lines[0]);
    const timestamp = parseInt(lines[1]);
    
    if (isNaN(pid) || isNaN(timestamp)) {
      return true; // Malformed lock file
    }
    
    // Check if process still exists
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
      return false; // Process exists, lock is not stale
    } catch {
      return true; // Process doesn't exist, lock is stale
    }
  } catch {
    return true; // Can't read lock file, assume stale
  }
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up any stale locks for a given file path.
 * This can be called on startup to clean up locks from crashed processes.
 */
export async function cleanStaleLocks(filePath: string): Promise<void> {
  const lockPath = `${filePath}.lock`;
  
  try {
    const isStale = await isLockStale(lockPath);
    if (isStale) {
      await fs.promises.unlink(lockPath);
    }
  } catch {
    // Ignore errors - lock might not exist or we might not have permissions
  }
}