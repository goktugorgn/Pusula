/**
 * Unbound Routes
 * GET /api/unbound/status
 * GET /api/unbound/stats
 * GET /api/unbound/logs
 * GET /api/unbound/connection
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
  getUnboundConnection,
  reloadUnbound,
  restartUnbound,
  flushAllCache,
  flushZone,
  flushRequest,
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
   * Query params: limit, level, since, cursor, follow
   */
  fastify.get(
    '/unbound/logs',
    {
      preHandler: validateQuery(logsQuerySchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as {
        limit?: number;
        level?: 'error' | 'warn' | 'info';
        since?: string;
        cursor?: string;
        follow?: boolean;
      };

      const result = await getUnboundLogs({
        limit: query.limit,
        level: query.level,
        since: query.since,
        cursor: query.cursor,
        follow: query.follow,
      });

      return {
        success: true,
        data: result,
      };
    }
  );

  /**
   * GET /api/unbound/connection
   * Returns connection status for UI health indicators
   */
  fastify.get('/unbound/connection', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const connection = await getUnboundConnection();

    return {
      success: true,
      data: connection,
    };
  });

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
   * Body: { type: "zone" | "request", value: string }
   */
  fastify.post(
    '/unbound/flush',
    {
      preHandler: validateBody(flushCacheRequestSchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { type, value } = request.body as { type: 'zone' | 'request'; value: string };
      const ip = getClientIp(request);
      const user = request.user.username;

      try {
        if (type === 'zone') {
          await flushZone(value);
          logCacheFlush(ip, user, 'zone', value);
          return {
            success: true,
            data: {
              ok: true,
              details: `Zone "${value}" flushed successfully`,
            },
          };
        } else {
          await flushRequest(value);
          logCacheFlush(ip, user, 'request', value);
          return {
            success: true,
            data: {
              ok: true,
              details: `Request "${value}" flushed successfully`,
            },
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logCacheFlush(ip, user, type, value, false);
        return {
          success: false,
          data: {
            ok: false,
            details: errorMsg,
          },
        };
      }
    }
  );
}

export default unboundRoutes;
