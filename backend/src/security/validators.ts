/**
 * Request validators using Zod schemas
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';
import {
  loginRequestSchema,
  changePasswordRequestSchema,
  flushRequestSchema,
  logsQuerySchema,
  upstreamUpdateSchema,
  alertAckRequestSchema,
} from '../config/schema.js';

/**
 * Create a validation hook for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    try {
      request.body = schema.parse(request.body);
      done();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        done(new ValidationError('Invalid request data', { errors: details }));
      } else {
        done(error as Error);
      }
    }
  };
}

/**
 * Create a validation hook for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    try {
      request.query = schema.parse(request.query) as typeof request.query;
      done();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        done(new ValidationError('Invalid query parameters', { errors: details }));
      } else {
        done(error as Error);
      }
    }
  };
}

// Pre-built validators for common requests
export const validateLoginRequest = validateBody(loginRequestSchema);
export const validateChangePasswordRequest = validateBody(changePasswordRequestSchema);
export const validateFlushRequest = validateBody(flushRequestSchema);
export const validateLogsQuery = validateQuery(logsQuerySchema);
export const validateUpstreamUpdate = validateBody(upstreamUpdateSchema);
export const validateAlertAckRequest = validateBody(alertAckRequestSchema);

// Re-export schemas for type inference
export {
  loginRequestSchema,
  changePasswordRequestSchema,
  flushRequestSchema,
  logsQuerySchema,
  upstreamUpdateSchema,
  alertAckRequestSchema,
};
