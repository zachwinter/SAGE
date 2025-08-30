export type { ISO8601, Clock, Random, TypedError } from './types.js';
export { SystemClock, FixedClock } from './clock.js';
export { SystemRandom, SeededRandom } from './random.js';
export { ErrorCodes, err, isTypedError, isErrorCode, serializeError, formatErrorMessage } from './errors.js';
export type { ErrorCode } from './errors.js';
export { canonicalJSONStringify } from './canonical.js';
export { sha256 } from './crypto.js';
export * from "./directories/index.js";
export { checkTTY } from "./tty.js";
export declare class Logger {
    private logger;
    private logFilePath;
    constructor(serviceName?: string, logFileName?: string);
    info(message: string, ...meta: any[]): void;
    warn(message: string, ...meta: any[]): void;
    error(message: string, ...meta: any[]): void;
    debug(message: string, ...meta: any[]): void;
    clearLogFile(): void;
}
//# sourceMappingURL=index.d.ts.map