export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = "Access denied") {
    super(message, "AUTHORIZATION_ERROR");
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string) {
    super(message, "DATABASE_ERROR");
  }
}

export class NetworkError extends BaseError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR");
  }
}

export function isBaseError(error: any): error is BaseError {
  return error instanceof BaseError;
}

export function handleError(error: unknown): BaseError {
  if (isBaseError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError(error.message, "UNKNOWN_ERROR");
  }

  return new BaseError("An unknown error occurred", "UNKNOWN_ERROR");
}
