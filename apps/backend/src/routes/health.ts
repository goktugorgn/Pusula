/**
 * Health Route
 * GET /api/health (public, no auth)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/health
   */
  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    return {
      success: true,
      data: {
        status: 'healthy',
        uptime,
        version: '1.0.0',
      },
    };
  });
}

export default healthRoutes;
