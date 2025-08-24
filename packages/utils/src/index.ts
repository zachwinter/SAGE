import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import fs from 'fs';
import path from 'path';

export class Logger {
  private logger: WinstonLogger;
  private logFilePath: string;

  constructor(serviceName: string = 'App', logFileName: string = 'app.log') {
    this.logFilePath = path.join(process.cwd(), logFileName);

    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
      ),
      defaultMeta: { service: serviceName },
      transports: [
        new transports.File({ filename: this.logFilePath })
      ]
    });
  }

  info(message: string, ...meta: any[]) {
    this.logger.info(message, ...meta);
  }

  warn(message: string, ...meta: any[]) {
    this.logger.warn(message, ...meta);
  }

  error(message: string, ...meta: any[]) {
    this.logger.error(message, ...meta);
  }

  debug(message: string, ...meta: any[]) {
    this.logger.debug(message, ...meta);
  }

  clearLogFile() {
    if (fs.existsSync(this.logFilePath)) {
      fs.unlinkSync(this.logFilePath);
    }
  }
}