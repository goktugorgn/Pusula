/**
 * Request validators using Zod schemas
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Create a pre-validation hook for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    try {
      request.body = schema.parse(request.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new ValidationError(messages.join('; '));
      }
      throw err;
    }
  };
}

/**
 * Create a pre-validation hook for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    try {
      request.query = schema.parse(request.query) as typeof request.query;
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new ValidationError(messages.join('; '));
      }
      throw err;
    }
  };
}

/**
 * Create a pre-validation hook for route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    try {
      request.params = schema.parse(request.params) as typeof request.params;
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new ValidationError(messages.join('; '));
      }
      throw err;
    }
  };
}
