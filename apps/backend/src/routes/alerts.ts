/**
 * Alert Routes
 * GET /api/alerts
 * POST /api/alerts/ack
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, getClientIp } from '../security/auth.js';
import { validateBody } from '../security/validators.js';
import { logAuditEvent } from '../security/auditLogger.js';
import { ackAlertRequestSchema } from '../config/index.js';
import {
  getAlerts,
  getActiveAlerts,
  acknowledgeAlert,
  type AlertStatus,
} from '../services/alertStore.js';
import { isEngineRunning } from '../services/alertEngine.js';
import { NotFoundError } from '../utils/errors.js';

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/alerts
   * Query: status?, limit?
   */
  fastify.get('/alerts', async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = request.query as { status?: AlertStatus; limit?: string };

    const alerts = getAlerts({
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return {
      success: true,
      data: {
        alerts,
        engineRunning: isEngineRunning(),
        activeCount: getActiveAlerts().length,
      },
    };
  });

  /**
   * GET /api/alerts/active
   */
  fastify.get('/alerts/active', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const alerts = getActiveAlerts();

    return {
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    };
  });

  /**
   * POST /api/alerts/ack
   * Body: { alertId: string }
   */
  fastify.post(
    '/alerts/ack',
    {
      preHandler: validateBody(ackAlertRequestSchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { alertId } = request.body as { alertId: string };
      const ip = getClientIp(request);
      const username = request.user.username;

      const alert = acknowledgeAlert(alertId, username);

      if (!alert) {
        throw new NotFoundError(`Alert not found: ${alertId}`);
      }

      // Audit log
      logAuditEvent({
        event: 'alert_ack',
        actor: { ip, user: username },
        details: { alertId, rule: alert.rule, severity: alert.severity },
        result: 'success',
      });

      return {
        success: true,
        data: {
          acknowledged: true,
          alert,
        },
      };
    }
  );
}

export default alertRoutes;
