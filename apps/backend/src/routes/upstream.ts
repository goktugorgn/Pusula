/**
 * Upstream Routes
 * GET /api/upstream
 * PUT /api/upstream
 * POST /api/self-test
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, getClientIp } from '../security/auth.js';
import { validateBody } from '../security/validators.js';
import { logConfigChange, logModeChange, logSelfTest } from '../security/auditLogger.js';
import { loadUpstreamConfig, updateUpstreamRequestSchema } from '../config/index.js';
import { applyConfig } from '../services/configManager.js';
import { runSelfTest, runQuickTest, getLastSelfTestResult } from '../services/selfTest.js';

export async function upstreamRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/upstream
   * Returns full upstream configuration
   */
  fastify.get('/upstream', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const config = loadUpstreamConfig();

    return {
      success: true,
      data: config,
    };
  });

  /**
   * PUT /api/upstream
   * Updates upstream configuration with apply workflow
   */
  fastify.put(
    '/upstream',
    {
      preHandler: validateBody(updateUpstreamRequestSchema),
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = request.body as {
        mode: 'recursive' | 'dot' | 'doh';
        dotProviders?: any[];
        dohProviders?: any[];
        activeOrder?: string[];
        dohProxy?: { type: 'cloudflared' | 'dnscrypt-proxy'; localPort: number };
        runSelfTest?: boolean;
      };

      const ip = getClientIp(request);
      const user = request.user.username;
      const currentConfig = loadUpstreamConfig();

      // Build new config (merge with current, not replace)
      const newConfig = {
        mode: body.mode,
        dotProviders: body.dotProviders ?? currentConfig.dotProviders,
        dohProviders: body.dohProviders ?? currentConfig.dohProviders,
        activeOrder: body.activeOrder ?? currentConfig.activeOrder,
        dohProxy: body.dohProxy ?? currentConfig.dohProxy,
      };

      // Log mode change if applicable
      if (body.mode !== currentConfig.mode) {
        logModeChange(ip, user, currentConfig.mode, body.mode, true);
      }

      try {
        // Apply config (creates snapshot, validates, applies, reloads)
        const { snapshotId } = await applyConfig(newConfig);

        // Run self-test if requested (default: true)
        let selfTestPassed = true;
        if (body.runSelfTest !== false) {
          selfTestPassed = await runQuickTest();

          if (!selfTestPassed) {
            logConfigChange(ip, user, 'apply', { mode: body.mode, snapshotId }, false, 'Self-test failed');

            return {
              success: false,
              error: {
                code: 'SELF_TEST_FAILED',
                message: 'Configuration applied but self-test failed. Rolled back.',
              },
            };
          }
        }

        logConfigChange(ip, user, 'apply', { mode: body.mode, snapshotId }, true);

        return {
          success: true,
          data: {
            applied: true,
            snapshotId,
            selfTestPassed,
          },
        };
      } catch (err) {
        logConfigChange(ip, user, 'apply', { mode: body.mode }, false, String(err));
        throw err;
      }
    }
  );

  /**
   * POST /api/self-test
   */
  fastify.post('/self-test', async (request: FastifyRequest, _reply: FastifyReply) => {
    const ip = getClientIp(request);
    const user = request.user.username;

    const result = await runSelfTest();
    const passed = result.summary.status === 'pass';

    logSelfTest(ip, user, passed, {
      steps: result.steps.map((s) => ({ name: s.name, status: s.status })),
      totalDurationMs: result.totalDurationMs,
    });

    return {
      success: true,
      data: result,
    };
  });
  
  /**
   * GET /api/self-test/last
   * Returns result of the last run self-test (or 404 if none)
   */
  fastify.get('/self-test/last', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = getLastSelfTestResult();
    
    if (!result) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No self-test has been run recently',
        },
      });
    }

    return {
      success: true,
      data: result,
    };
  });
}

export default upstreamRoutes;
