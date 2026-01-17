/**
 * Authentication middleware and utilities
 * 
 * JWT-based authentication with httpOnly cookies
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { UnauthorizedError } from '../utils/errors.js';
import { loadCredentials } from '../config/index.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { username: string };
    user: { username: string };
  }
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash a new password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify credentials
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
 * Create authentication hook for Fastify
 */
export function createAuthHook(fastify: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check for token in cookie first, then Authorization header
      const token = request.cookies?.pusula_token;
      
      if (token) {
        request.headers.authorization = `Bearer ${token}`;
      }

      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError();
    }
  };
}

/**
 * Get client IP from request
 */
export function getClientIp(request: FastifyRequest): string {
  // Check X-Forwarded-For header (for reverse proxy)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  // Fall back to direct IP
  return request.ip;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: FastifyRequest): string | undefined {
  return request.headers['user-agent'];
}

/**
 * Get username from JWT payload
 */
export function getUsername(request: FastifyRequest): string {
  return request.user?.username || 'unknown';
}

/**
 * Create JWT token
 */
export async function createToken(
  fastify: FastifyInstance,
  username: string,
  expiresIn: string = '24h'
): Promise<string> {
  return fastify.jwt.sign({ username }, { expiresIn });
}

/**
 * Set auth cookie
 */
export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie('pusula_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 86400, // 24 hours in seconds
  });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie('pusula_token', {
    path: '/',
  });
}
