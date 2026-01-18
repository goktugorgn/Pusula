/**
 * Pi-hole Routes
 * GET /api/pihole/summary
 * GET /api/pihole/status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../security/auth.js';
import {
  getPiholeSummary,
  isPiholeConfigured,
  getPiholeConfig,
} from '../services/piholeClient.js';
import { ServiceError } from '../utils/errors.js';

export async function piholeRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/pihole/summary
   * Returns Pi-hole statistics or configuration guidance
   */
  fastify.get('/pihole/summary', async (_request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const summary = await getPiholeSummary();

      return {
        success: true,
        data: summary,
      };
    } catch (err) {
      // If Pi-hole is configured but API fails
      if (isPiholeConfigured()) {
        throw new ServiceError(
          `Failed to fetch Pi-hole summary: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }

      // Not configured - return guidance
      return {
        success: true,
        data: {
          configured: false,
          guidance: 'Pi-hole integration is not configured.',
        },
      };
    }
  });

  /**
   * GET /api/pihole/status
   * Returns configuration status only
   */
  fastify.get('/pihole/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const config = getPiholeConfig();

    return {
      success: true,
      data: {
        configured: isPiholeConfigured(),
        enabled: config.enabled,
        baseUrl: config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : null,
      },
    };
  });
}

export default piholeRoutes;
