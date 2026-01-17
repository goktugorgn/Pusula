/**
 * Custom error types for Pusula backend
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid or missing token') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request data', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, try again later') {
    super('RATE_LIMITED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class LockoutError extends AppError {
  constructor(remainingMinutes: number) {
    super('LOCKED_OUT', `Account locked, try again in ${remainingMinutes} minutes`, 423);
    this.name = 'LockoutError';
  }
}

export class ServiceError extends AppError {
  constructor(message = 'Backend service unavailable') {
    super('SERVICE_ERROR', message, 503);
    this.name = 'ServiceError';
  }
}

export class CommandError extends AppError {
  constructor(command: string, message: string) {
    super('COMMAND_ERROR', `Command '${command}' failed: ${message}`, 500);
    this.name = 'CommandError';
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error): {
  success: false;
  error: { code: string; message: string };
} {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    },
  };
}
