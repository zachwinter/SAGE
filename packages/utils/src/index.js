// Export clock implementations
export { SystemClock, FixedClock } from './clock.js';
// Export random implementations
export { SystemRandom, SeededRandom } from './random.js';
// Export error handling
export { ErrorCodes, err, isTypedError, isErrorCode, serializeError, formatErrorMessage } from './errors.js';
// Export canonicalization and crypto
export { canonicalJSONStringify } from './canonical.js';
export { sha256 } from './crypto.js';
// Export directory management system
export * from "./directories/index.js";
// Export TTY utilities
export { checkTTY } from "./tty.js";
import { createLogger, format, transports } from "winston";
import fs from "fs";
import path from "path";
export class Logger {
    logger;
    logFilePath;
    constructor(serviceName = "App", logFileName = "app.log") {
        this.logFilePath = path.join(process.cwd(), logFileName);
        this.logger = createLogger({
            level: "info",
            format: format.combine(format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss"
            }), format.errors({ stack: true }), format.splat(), format.json()),
            defaultMeta: { service: serviceName },
            transports: [new transports.File({ filename: this.logFilePath })]
        });
    }
    info(message, ...meta) {
        this.logger.info(message, ...meta);
    }
    warn(message, ...meta) {
        this.logger.warn(message, ...meta);
    }
    error(message, ...meta) {
        this.logger.error(message, ...meta);
    }
    debug(message, ...meta) {
        this.logger.debug(message, ...meta);
    }
    clearLogFile() {
        if (fs.existsSync(this.logFilePath)) {
            fs.unlinkSync(this.logFilePath);
        }
    }
}
//# sourceMappingURL=index.js.map