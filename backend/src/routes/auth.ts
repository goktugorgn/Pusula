/**
 * Authentication routes
 * 
 * POST /api/login
 * POST /api/user/change-password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { writeFileSync } from 'fs';
import {
  verifyCredentials,
  hashPassword,
  createToken,
  setAuthCookie,
  clearAuthCookie,
  getClientIp,
  getUserAgent,
  getUsername,
  createAuthHook,
} from '../security/auth.js';
import {
  checkLoginRateLimit,
  resetLoginRateLimit,
} from '../security/rateLimit.js';
import {
  checkLockout,
  recordLoginFailure,
  recordLoginSuccess,
} from '../security/lockout.js';
import {
  logLoginSuccess,
  logLoginFailure,
  logPasswordChange,
} from '../security/auditLogger.js';
import {
  validateLoginRequest,
  validateChangePasswordRequest,
  loginRequestSchema,
  changePasswordRequestSchema,
} from '../security/validators.js';
import { loadCredentials, getConfig } from '../config/index.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { z } from 'zod';

type LoginBody = z.infer<typeof loginRequestSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordRequestSchema>;

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  /**
   * POST /api/login
   */
  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      preValidation: validateLoginRequest,
    },
    async (request, reply) => {
      const ip = getClientIp(request);
      const userAgent = getUserAgent(request);
      const { username, password } = request.body;

      // Check rate limit
      checkLoginRateLimit(ip);

      // Check lockout
      checkLockout(ip);

      // Verify credentials
      const valid = await verifyCredentials(username, password);

      if (!valid) {
        recordLoginFailure(ip);
        logLoginFailure(ip, userAgent, 'Invalid credentials');
        throw new UnauthorizedError('Invalid username or password');
      }

      // Success - clear lockout and rate limit
      recordLoginSuccess(ip);
      resetLoginRateLimit(ip);
      logLoginSuccess(ip, username, userAgent);

      // Generate token
      const token = await createToken(fastify, username, config.tokenExpiry);

      // Set cookie
      setAuthCookie(reply, token);

      return {
        success: true,
        data: {
          token,
          expiresIn: 86400, // 24 hours in seconds
        },
      };
    }
  );

  /**
   * POST /api/user/change-password
   */
  fastify.post<{ Body: ChangePasswordBody }>(
    '/user/change-password',
    {
      preHandler: createAuthHook(fastify),
      preValidation: validateChangePasswordRequest,
    },
    async (request, reply) => {
      const ip = getClientIp(request);
      const username = getUsername(request);
      const { currentPassword, newPassword } = request.body;

      // Verify current password
      const valid = await verifyCredentials(username, currentPassword);

      if (!valid) {
        logPasswordChange(ip, username, false);
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 12) {
        throw new ValidationError('New password must be at least 12 characters');
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Update credentials file
      const credentials = loadCredentials();
      credentials.passwordHash = newHash;

      const credentialsPath = process.env.CREDENTIALS_PATH || '/etc/unbound-ui/credentials.json';
      writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });

      logPasswordChange(ip, username, true);

      // Clear cookie to force re-login
      clearAuthCookie(reply);

      return {
        success: true,
      };
    }
  );

  /**
   * POST /api/logout (optional convenience endpoint)
   */
  fastify.post(
    '/logout',
    async (request, reply) => {
      clearAuthCookie(reply);
      return { success: true };
    }
  );
}
