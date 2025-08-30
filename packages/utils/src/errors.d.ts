import type { TypedError } from './types.js';
export declare const ErrorCodes: {
    readonly VALIDATION: "EVALIDATION";
    readonly PERMISSION: "EPERMISSION";
    readonly TIMEOUT: "ETIMEOUT";
    readonly IO: "EIO";
    readonly LOCK_TIMEOUT: "ELOCK_TIMEOUT";
    readonly HALT: "EHALT";
};
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
export declare function err(code: string, message: string, cause?: unknown): TypedError;
export declare function isTypedError(error: unknown): error is TypedError;
export declare function isErrorCode(error: unknown, code: string): boolean;
export declare function serializeError(error: TypedError): Record<string, unknown>;
export declare function formatErrorMessage(error: TypedError): string;
//# sourceMappingURL=errors.d.ts.map