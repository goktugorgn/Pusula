/**
 * Custom error types for API responses
 * Maps to OpenAPI error schemas
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

// 400 Bad Request
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

// 423 Locked (Account lockout)
export class LockoutError extends AppError {
  public readonly retryAfterMinutes: number;

  constructor(retryAfterMinutes: number) {
    super(
      `Account temporarily locked. Try again in ${retryAfterMinutes} minutes.`,
      423,
      'LOCKED_OUT'
    );
    this.retryAfterMinutes = retryAfterMinutes;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        retryAfter: this.retryAfterMinutes * 60,
      },
    };
  }
}

// 429 Too Many Requests
export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests. Please slow down.', 429, 'RATE_LIMITED');
    this.retryAfterSeconds = retryAfterSeconds;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        retryAfter: this.retryAfterSeconds,
      },
    };
  }
}

// 500 Internal Server Error
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

// 503 Service Unavailable
export class ServiceError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503, 'SERVICE_ERROR');
  }
}

// Command execution error
export class CommandError extends AppError {
  public readonly command: string;
  public readonly stderr: string;

  constructor(command: string, stderr: string) {
    super(`Command failed: ${command}`, 500, 'COMMAND_ERROR');
    this.command = command;
    this.stderr = stderr;
  }
}
