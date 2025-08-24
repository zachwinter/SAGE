export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  source: string;
}

export class Logger {
  private source: string;
  private minLevel: LogLevel;

  constructor(source: string, minLevel: LogLevel = "info") {
    this.source = source;
    this.minLevel = minLevel;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log("error", message, context);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      source: this.source
    };

    this.output(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private output(entry: LogEntry): void {
    const formatted = this.format(entry);

    if (entry.level === "error") {
      console.error(formatted);
    } else if (entry.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  private format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source.padEnd(15);

    let formatted = `${timestamp} [${level}] ${source} ${entry.message}`;

    if (entry.context) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }

    return formatted;
  }

  static create(source: string): Logger {
    return new Logger(source);
  }
}
