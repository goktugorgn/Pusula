/**
 * Health route
 * 
 * GET /api/health (public, no auth required)
 */

import type { FastifyInstance } from 'fastify';

const startTime = Date.now();
const version = process.env.npm_package_version || '0.1.0';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/health
   */
  fastify.get('/health', async () => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    return {
      success: true,
      data: {
        status: 'healthy',
        uptime,
        version,
      },
    };
  });
}
