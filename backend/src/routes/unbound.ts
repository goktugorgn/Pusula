/**
 * Unbound routes
 * 
 * GET /api/unbound/status
 * GET /api/unbound/stats
 * GET /api/unbound/logs
 * POST /api/unbound/reload
 * POST /api/unbound/restart
 * POST /api/unbound/flush
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as unboundControl from '../services/unboundControl.js';
import * as logReader from '../services/logReader.js';
import { createAuthHook, getClientIp, getUsername } from '../security/auth.js';
import {
  logServiceReload,
  logServiceRestart,
  logCacheFlush,
} from '../security/auditLogger.js';
import {
  validateLogsQuery,
  validateFlushRequest,
  logsQuerySchema,
  flushRequestSchema,
} from '../security/validators.js';
import { ServiceError } from '../utils/errors.js';

type LogsQuery = z.infer<typeof logsQuerySchema>;
type FlushBody = z.infer<typeof flushRequestSchema>;

export async function unboundRoutes(fastify: FastifyInstance): Promise<void> {
  const authHook = createAuthHook(fastify);

  /**
   * GET /api/unbound/status
   */
  fastify.get(
    '/unbound/status',
    { preHandler: authHook },
    async () => {
      const status = await unboundControl.getStatus();

      return {
        success: true,
        data: {
          running: status.running,
          uptime: status.uptime,
          version: status.version,
          mode: status.mode,
        },
      };
    }
  );

  /**
   * GET /api/unbound/stats
   */
  fastify.get(
    '/unbound/stats',
    { preHandler: authHook },
    async () => {
      const stats = await unboundControl.getStats();

      return {
        success: true,
        data: stats,
      };
    }
  );

  /**
   * GET /api/unbound/logs
   */
  fastify.get<{ Querystring: LogsQuery }>(
    '/unbound/logs',
    {
      preHandler: authHook,
      preValidation: validateLogsQuery,
    },
    async (request) => {
      const { level, since, limit } = request.query;

      const entries = await logReader.getUnboundLogs({
        level: level as 'error' | 'warn' | 'info' | 'debug' | undefined,
        since,
        limit,
      });

      return {
        success: true,
        data: {
          entries,
          total: entries.length,
        },
      };
    }
  );

  /**
   * POST /api/unbound/reload
   */
  fastify.post(
    '/unbound/reload',
    { preHandler: authHook },
    async (request) => {
      const ip = getClientIp(request);
      const user = getUsername(request);

      const success = await unboundControl.reload();
      logServiceReload(ip, user, success);

      if (!success) {
        throw new ServiceError('Failed to reload Unbound');
      }

      return {
        success: true,
      };
    }
  );

  /**
   * POST /api/unbound/restart
   */
  fastify.post(
    '/unbound/restart',
    { preHandler: authHook },
    async (request) => {
      const ip = getClientIp(request);
      const user = getUsername(request);

      const success = await unboundControl.restart();
      logServiceRestart(ip, user, success);

      if (!success) {
        throw new ServiceError('Failed to restart Unbound');
      }

      return {
        success: true,
      };
    }
  );

  /**
   * POST /api/unbound/flush
   */
  fastify.post<{ Body: FlushBody }>(
    '/unbound/flush',
    {
      preHandler: authHook,
      preValidation: validateFlushRequest,
    },
    async (request) => {
      const ip = getClientIp(request);
      const user = getUsername(request);
      const { type, zone } = request.body;

      let success: boolean;

      if (type === 'zone' && zone) {
        success = await unboundControl.flushZone(zone);
        logCacheFlush(ip, user, zone);
      } else {
        success = await unboundControl.flushAll();
        logCacheFlush(ip, user);
      }

      if (!success) {
        throw new ServiceError('Failed to flush cache');
      }

      return {
        success: true,
      };
    }
  );
}
