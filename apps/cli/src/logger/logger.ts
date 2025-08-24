import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface LogContext {
  [key: string]: any;
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

export class Logger {
  private static logDir = path.join(os.homedir(), ".sage", "logs");
  private static logFile = path.join(Logger.logDir, "app.log");
  private static maxLogSize = 10 * 1024 * 1024; // 10MB
  private static maxLogFiles = 5;
  private static configuredLogLevel: LogLevel = "INFO";

  static {
    // This static initialization block runs once when the class is loaded.
    Logger.ensureLogDirectory();
    Logger.setLogLevelFromEnv();
  }

  private static setLogLevelFromEnv(): void {
    const envLevel = process.env.SAGE_LOG_LEVEL?.toUpperCase() as LogLevel;
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
      this.configuredLogLevel = envLevel;
      // Initial log to confirm level, useful for debugging the logger itself
      this.writeToFile(
        "INFO",
        `Log level set to ${this.configuredLogLevel} from SAGE_LOG_LEVEL.`
      );
    } else if (process.env.NODE_ENV === "development") {
      this.configuredLogLevel = "DEBUG";
      this.writeToFile(
        "INFO",
        `Log level set to DEBUG for development environment.`
      );
    }
  }

  private static ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(Logger.logDir)) {
        fs.mkdirSync(Logger.logDir, { recursive: true });
      }
    } catch (error) {
      // Fallback to console if we can't create log directory
      console.error("Failed to create log directory:", error);
    }
  }

  private static rotateLogIfNeeded(): void {
    // Disable rotation during tests to prevent file system chaos
    if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
      return;
    }

    try {
      if (!fs.existsSync(Logger.logFile)) {
        return;
      }

      const stats = fs.statSync(Logger.logFile);
      if (stats.size >= Logger.maxLogSize) {
        // Rotate existing log files
        for (let i = Logger.maxLogFiles - 1; i > 0; i--) {
          const oldFile = path.join(Logger.logDir, `app.log.${i}`);
          const newFile = path.join(Logger.logDir, `app.log.${i + 1}`);

          if (fs.existsSync(oldFile)) {
            if (i === Logger.maxLogFiles - 1) {
              fs.unlinkSync(oldFile); // Delete oldest
            } else {
              fs.renameSync(oldFile, newFile);
            }
          }
        }

        // Move current log to .1
        const rotatedFile = path.join(Logger.logDir, "app.log.1");
        fs.renameSync(Logger.logFile, rotatedFile);
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  private static writeToFile(level: LogLevel, message: string, extra?: any): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.configuredLogLevel]) {
      return;
    }
    try {
      Logger.rotateLogIfNeeded();

      const timestamp = new Date().toISOString();
      const pid = process.pid;
      const logEntry = {
        timestamp,
        level,
        pid,
        message,
        ...(extra && { extra })
      };

      const logLine = JSON.stringify(logEntry) + "\n";
      fs.appendFileSync(Logger.logFile, logLine);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error("Failed to write to log file:", error);
      const fallbackMsg = `[${level}] ${message}`;
      if (level === "ERROR") {
        console.error(fallbackMsg, extra || "");
      } else if (level === "WARN") {
        console.warn(fallbackMsg, extra || "");
      } else {
        console.log(fallbackMsg, extra || "");
      }
    }
  }

  static debug(message: string, context?: LogContext): void {
    Logger.writeToFile("DEBUG", message, context);
  }

  static info(message: string, context?: LogContext): void {
    Logger.writeToFile("INFO", message, context);
  }

  static warn(message: string, context?: LogContext): void {
    Logger.writeToFile("WARN", message, context);
  }

  static error(message: string, error?: Error | string, context?: LogContext): void {
    const errorData =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        : error;

    Logger.writeToFile("ERROR", message, {
      error: errorData,
      ...context
    });
  }

  static getLogPath(): string {
    return Logger.logFile;
  }

  static getLogDir(): string {
    return Logger.logDir;
  }
}

export default Logger;
