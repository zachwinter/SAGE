import { Logger } from "./interfaces.js";

export class RealLogger implements Logger {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta);
  }

  error(message: string, error?: Error, meta?: any) {
    console.error(`[ERROR] ${message}`, error, meta);
  }

  debug(message: string, meta?: any) {
    console.debug(`[DEBUG] ${message}`, meta);
  }
}
