/**
 * Unbound Routes
 * GET /api/unbound/status
 * GET /api/unbound/stats
 * GET /api/unbound/logs
 * POST /api/unbound/reload
 * POST /api/unbound/restart
 * POST /api/unbound/flush
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, getClientIp } from '../security/auth.js';
import { validateBody, validateQuery } from '../security/validators.js';
import { logServiceOp, logCacheFlush } from '../security/auditLogger.js';
import { logsQuerySchema, flushCacheRequestSchema, loadUpstreamConfig } from '../config/index.js';
import {
  getUnboundStatus,
  getUnboundStats,
  reloadUnbound,
  restartUnbound,
  flushAllCache,
  flushZone,
} from '../services/unboundControl.js';
import { getUnboundLogs } from '../services/logReader.js';

export async function unboundRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/unbound/status
   */
  fastify.get('/unbound/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const status = await getUnboundStatus();
    const upstream = loadUpstreamConfig();

    return {
      success: true,
      data: {
        ...status,
        mode: upstream.mode,
      },
    };
  });

  /**
   * GET /api/unbound/stats
   */
  fastify.get('/unbound/stats', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const stats = await getUnboundStats();

    return {
      success: true,
      data: stats,
    };
  });

  /**
   * GET /api/unbound/logs
   */
  fastify.get(
    '/unbound/logs',
    {
      preHandler: validateQuery(logsQuerySchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { limit?: number; level?: string; since?: string };

      const result = await getUnboundLogs({
        limit: query.limit,
        level: query.level,
        since: query.since,
      });

      return {
        success: true,
        data: result,
      };
    }
  );

  /**
   * POST /api/unbound/reload
   */
  fastify.post('/unbound/reload', async (request: FastifyRequest, _reply: FastifyReply) => {
    const ip = getClientIp(request);
    const user = request.user.username;

    try {
      await reloadUnbound();
      logServiceOp(ip, user, 'reload', 'unbound', true);

      return {
        success: true,
        data: {
          message: 'Configuration reloaded successfully',
        },
      };
    } catch (err) {
      logServiceOp(ip, user, 'reload', 'unbound', false, String(err));
      throw err;
    }
  });

  /**
   * POST /api/unbound/restart
   */
  fastify.post('/unbound/restart', async (request: FastifyRequest, _reply: FastifyReply) => {
    const ip = getClientIp(request);
    const user = request.user.username;

    try {
      await restartUnbound();
      logServiceOp(ip, user, 'restart', 'unbound', true);

      return {
        success: true,
        data: {
          message: 'Service restarted successfully',
        },
      };
    } catch (err) {
      logServiceOp(ip, user, 'restart', 'unbound', false, String(err));
      throw err;
    }
  });

  /**
   * POST /api/unbound/flush
   */
  fastify.post(
    '/unbound/flush',
    {
      preHandler: validateBody(flushCacheRequestSchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { type, zone } = request.body as { type: 'all' | 'zone'; zone?: string };
      const ip = getClientIp(request);
      const user = request.user.username;

      if (type === 'zone' && zone) {
        await flushZone(zone);
        logCacheFlush(ip, user, 'zone', zone);
      } else {
        await flushAllCache();
        logCacheFlush(ip, user, 'all');
      }

      return {
        success: true,
        data: {
          message: type === 'zone' ? `Zone ${zone} flushed` : 'All cache flushed',
        },
      };
    }
  );
}

export default unboundRoutes;
