/**
 * Authentication module
 * Handles password hashing and JWT operations
 */

import * as argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../utils/errors.js';
import { loadCredentials } from '../config/index.js';

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Verify credentials against stored values
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const credentials = loadCredentials();

  if (username !== credentials.username) {
    return false;
  }

  return verifyPassword(password, credentials.passwordHash);
}

/**
 * Create a JWT token for authenticated user
 */
export async function createToken(
  fastify: FastifyInstance,
  username: string
): Promise<string> {
  return fastify.jwt.sign(
    { username },
    { expiresIn: '24h' }
  );
}

/**
 * Set auth cookie on response
 */
export function setAuthCookie(
  reply: FastifyReply,
  token: string
): void {
  reply.setCookie('token', token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400, // 24 hours
  });
}

/**
 * Clear auth cookie on logout
 */
export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

/**
 * Extract client IP from request
 */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return request.ip;
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: FastifyRequest): string {
  return request.headers['user-agent'] || 'unknown';
}

/**
 * Authentication hook for protected routes
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Try cookie first, then Authorization header
    const token =
      request.cookies.token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify token
    await request.jwtVerify();
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Declare JWT payload type for typed access
 */
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { username: string };
    user: { username: string };
  }
}
