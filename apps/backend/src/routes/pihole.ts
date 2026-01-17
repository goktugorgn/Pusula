/**
 * Pi-hole Route
 * GET /api/pihole/summary
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../security/auth.js';
import { getPiholeSummary, isPiholeEnabled } from '../services/piholeClient.js';
import { ServiceError } from '../utils/errors.js';

export async function piholeRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/pihole/summary
   */
  fastify.get('/pihole/summary', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!isPiholeEnabled()) {
      throw new ServiceError('Pi-hole integration is not enabled');
    }

    const summary = await getPiholeSummary();

    if (!summary) {
      throw new ServiceError('Failed to fetch Pi-hole summary');
    }

    return {
      success: true,
      data: summary,
    };
  });
}

export default piholeRoutes;
