/**
 * Auth Routes
 * POST /api/login
 * POST /api/user/change-password
 * POST /api/logout
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  verifyCredentials,
  createToken,
  setAuthCookie,
  clearAuthCookie,
  hashPassword,
  getClientIp,
  getUserAgent,
  authenticate,
} from '../security/auth.js';
import { checkLockout, recordLoginFailure, recordLoginSuccess } from '../security/lockout.js';
import { logLogin, logPasswordChange } from '../security/auditLogger.js';
import { validateBody } from '../security/validators.js';
import { loginRequestSchema, changePasswordRequestSchema, loadCredentials } from '../config/index.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { writeFileSync } from 'node:fs';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/login
   */
  fastify.post(
    '/login',
    {
      preHandler: validateBody(loginRequestSchema),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { username, password } = request.body as { username: string; password: string };
      const ip = getClientIp(request);
      const userAgent = getUserAgent(request);

      // Check lockout
      checkLockout(ip);

      // Verify credentials
      const valid = await verifyCredentials(username, password);

      if (!valid) {
        recordLoginFailure(ip);
        logLogin(ip, username, false, userAgent, 'Invalid credentials');
        throw new UnauthorizedError('Invalid username or password');
      }

      // Success
      recordLoginSuccess(ip);
      logLogin(ip, username, true, userAgent);

      // Generate token
      const token = await createToken(fastify, username);
      setAuthCookie(reply, token);

      return {
        success: true,
        data: {
          token,
          expiresIn: 86400, // 24 hours
        },
      };
    }
  );

  /**
   * POST /api/user/change-password
   */
  fastify.post(
    '/user/change-password',
    {
      preHandler: [authenticate, validateBody(changePasswordRequestSchema)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const ip = getClientIp(request);
      const user = request.user.username;

      // Verify current password
      const valid = await verifyCredentials(user, currentPassword);
      if (!valid) {
        logPasswordChange(ip, user, false, 'Invalid current password');
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password strength
      if (newPassword.length < 12) {
        throw new ValidationError('Password must be at least 12 characters');
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Update credentials file
      const credentialsPath =
        process.env.CREDENTIALS_PATH || '/etc/unbound-ui/credentials.json';

      const credentials = loadCredentials();
      credentials.passwordHash = newHash;

      writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

      logPasswordChange(ip, user, true);

      // Clear auth cookie (force re-login)
      clearAuthCookie(reply);

      return {
        success: true,
        data: {
          message: 'Password changed successfully. Please log in again.',
        },
      };
    }
  );

  /**
   * POST /api/logout
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    clearAuthCookie(reply);

    return {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    };
  });
}

export default authRoutes;
