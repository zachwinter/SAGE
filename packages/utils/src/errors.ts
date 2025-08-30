import type { TypedError } from './types.js';

export const ErrorCodes = {
  VALIDATION: 'EVALIDATION',
  PERMISSION: 'EPERMISSION', 
  TIMEOUT: 'ETIMEOUT',
  IO: 'EIO',
  LOCK_TIMEOUT: 'ELOCK_TIMEOUT',
  HALT: 'EHALT',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

class TypedErrorImpl extends Error implements TypedError {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
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

export function err(code: string, message: string, cause?: unknown): TypedError {
  return new TypedErrorImpl(code, message, cause);
}

export function isTypedError(error: unknown): error is TypedError {
  return error instanceof Error && 'code' in error && typeof (error as any).code === 'string';
}

export function isErrorCode(error: unknown, code: string): boolean {
  return isTypedError(error) && error.code === code;
}

export function serializeError(error: TypedError): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    cause: error.cause,
    stack: error.stack,
  };
}

export function formatErrorMessage(error: TypedError): string {
  const parts = [`[${error.code}] ${error.message}`];
  
  if (error.cause) {
    if (error.cause instanceof Error) {
      parts.push(`Caused by: ${error.cause.message}`);
    } else {
      parts.push(`Caused by: ${String(error.cause)}`);
    }
  }
  
  return parts.join('\n');
}