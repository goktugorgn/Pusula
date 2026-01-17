/**
 * Alert Routes
 * GET /api/alerts
 * POST /api/alerts/ack
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, getClientIp } from '../security/auth.js';
import { validateBody } from '../security/validators.js';
import { logAlertAck } from '../security/auditLogger.js';
import { ackAlertRequestSchema } from '../config/index.js';
import { getAlerts, acknowledgeAlert } from '../services/alertEngine.js';
import { NotFoundError } from '../utils/errors.js';

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/alerts
   */
  fastify.get('/alerts', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const alerts = getAlerts();

    return {
      success: true,
      data: {
        alerts,
      },
    };
  });

  /**
   * POST /api/alerts/ack
   */
  fastify.post(
    '/alerts/ack',
    {
      preHandler: validateBody(ackAlertRequestSchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { alertId } = request.body as { alertId: string };
      const ip = getClientIp(request);
      const user = request.user.username;

      const removed = acknowledgeAlert(alertId);

      if (!removed) {
        throw new NotFoundError(`Alert not found: ${alertId}`);
      }

      logAlertAck(ip, user, alertId);

      return {
        success: true,
        data: {
          message: 'Alert acknowledged',
        },
      };
    }
  );
}

export default alertRoutes;
