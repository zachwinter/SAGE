// src/logger.ts
// Simple debug logger for development

import { writeFileSync } from 'fs';
import { join } from 'path';

const LOG_FILE = join(process.cwd(), 'debug.log');

export function debugLog(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = data ? 
    `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}\n` :
    `[${timestamp}] ${message}\n`;
  
  try {
    writeFileSync(LOG_FILE, logEntry, { flag: 'a' });
  } catch (error) {
    console.error('Failed to write to debug log:', error);
  }
}