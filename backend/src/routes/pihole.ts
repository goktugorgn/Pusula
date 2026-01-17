/**
 * Pi-hole routes
 * 
 * GET /api/pihole/summary
 */

import type { FastifyInstance } from 'fastify';
import * as piholeClient from '../services/piholeClient.js';
import { createAuthHook } from '../security/auth.js';
import { ServiceError } from '../utils/errors.js';

export async function piholeRoutes(fastify: FastifyInstance): Promise<void> {
  const authHook = createAuthHook(fastify);

  /**
   * GET /api/pihole/summary
   */
  fastify.get(
    '/pihole/summary',
    { preHandler: authHook },
    async () => {
      const summary = await piholeClient.getSummary();

      if (!summary) {
        throw new ServiceError('Pi-hole integration not enabled or not reachable');
      }

      return {
        success: true,
        data: summary,
      };
    }
  );
}
