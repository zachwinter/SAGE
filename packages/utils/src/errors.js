export const ErrorCodes = {
    VALIDATION: 'EVALIDATION',
    PERMISSION: 'EPERMISSION',
    TIMEOUT: 'ETIMEOUT',
    IO: 'EIO',
    LOCK_TIMEOUT: 'ELOCK_TIMEOUT',
    HALT: 'EHALT',
};
class TypedErrorImpl extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.name = 'TypedError';
        this.code = code;
        this.cause = cause;
        // Maintain proper prototype chain
        Object.setPrototypeOf(this, TypedErrorImpl.prototype);
        // Capture stack trace, excluding this constructor
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TypedErrorImpl);
        }
    }
}
export function err(code, message, cause) {
    return new TypedErrorImpl(code, message, cause);
}
export function isTypedError(error) {
    return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
export function isErrorCode(error, code) {
    return isTypedError(error) && error.code === code;
}
export function serializeError(error) {
    return {
        name: error.name,
        message: error.message,
        code: error.code,
        cause: error.cause,
        stack: error.stack,
    };
}
export function formatErrorMessage(error) {
    const parts = [`[${error.code}] ${error.message}`];
    if (error.cause) {
        if (error.cause instanceof Error) {
            parts.push(`Caused by: ${error.cause.message}`);
        }
        else {
            parts.push(`Caused by: ${String(error.cause)}`);
        }
    }
    return parts.join('\n');
}
//# sourceMappingURL=errors.js.map