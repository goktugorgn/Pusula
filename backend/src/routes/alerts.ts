/**
 * Alert routes
 * 
 * GET /api/alerts
 * POST /api/alerts/ack
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as alertEngine from '../services/alertEngine.js';
import { createAuthHook, getClientIp, getUsername } from '../security/auth.js';
import { logAlertAck } from '../security/auditLogger.js';
import {
  validateAlertAckRequest,
  alertAckRequestSchema,
} from '../security/validators.js';
import { NotFoundError } from '../utils/errors.js';

type AlertAckBody = z.infer<typeof alertAckRequestSchema>;

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  const authHook = createAuthHook(fastify);

  /**
   * GET /api/alerts
   */
  fastify.get(
    '/alerts',
    { preHandler: authHook },
    async () => {
      const alerts = alertEngine.getActiveAlerts();

      return {
        success: true,
        data: {
          alerts: alerts.map(alert => ({
            id: alert.id,
            severity: alert.severity,
            type: alert.type,
            message: alert.message,
            timestamp: alert.timestamp,
          })),
        },
      };
    }
  );

  /**
   * POST /api/alerts/ack
   */
  fastify.post<{ Body: AlertAckBody }>(
    '/alerts/ack',
    {
      preHandler: authHook,
      preValidation: validateAlertAckRequest,
    },
    async (request) => {
      const ip = getClientIp(request);
      const user = getUsername(request);
      const { alertId } = request.body;

      const acknowledged = alertEngine.acknowledgeAlert(alertId);

      if (!acknowledged) {
        throw new NotFoundError(`Alert not found: ${alertId}`);
      }

      logAlertAck(ip, user, alertId);

      return {
        success: true,
      };
    }
  );
}
