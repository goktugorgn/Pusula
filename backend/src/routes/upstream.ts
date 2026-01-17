/**
 * Upstream routes
 * 
 * GET /api/upstream
 * PUT /api/upstream
 * POST /api/self-test
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as configManager from '../services/configManager.js';
import * as selfTest from '../services/selfTest.js';
import { createAuthHook, getClientIp, getUsername } from '../security/auth.js';
import {
  logConfigApply,
  logConfigRollback,
  logModeChange,
  logUpstreamChange,
} from '../security/auditLogger.js';
import {
  validateUpstreamUpdate,
  upstreamUpdateSchema,
} from '../security/validators.js';
import { ValidationError, ServiceError } from '../utils/errors.js';

type UpstreamUpdateBody = z.infer<typeof upstreamUpdateSchema>;

export async function upstreamRoutes(fastify: FastifyInstance): Promise<void> {
  const authHook = createAuthHook(fastify);

  /**
   * GET /api/upstream
   */
  fastify.get(
    '/upstream',
    { preHandler: authHook },
    async () => {
      const config = configManager.getCurrentUpstreamConfig();

      // Transform to API format
      const upstreams: Array<{
        id?: string;
        type: 'dot' | 'doh';
        address: string;
        name?: string;
        enabled: boolean;
        priority?: number;
      }> = [];

      // Add DoT providers
      for (const provider of config.dotProviders) {
        upstreams.push({
          id: provider.id,
          type: 'dot',
          address: `${provider.address}:${provider.port}`,
          name: provider.name,
          enabled: provider.enabled,
          priority: provider.priority,
        });
      }

      // Add DoH providers
      for (const provider of config.dohProviders) {
        upstreams.push({
          id: provider.id,
          type: 'doh',
          address: provider.endpointUrl,
          name: provider.name,
          enabled: provider.enabled,
          priority: provider.priority,
        });
      }

      return {
        success: true,
        data: {
          mode: config.mode,
          upstreams,
        },
      };
    }
  );

  /**
   * PUT /api/upstream
   */
  fastify.put<{ Body: UpstreamUpdateBody }>(
    '/upstream',
    {
      preHandler: authHook,
      preValidation: validateUpstreamUpdate,
    },
    async (request) => {
      const ip = getClientIp(request);
      const user = getUsername(request);
      const { mode, upstreams } = request.body;

      // Get current config
      const currentConfig = configManager.getCurrentUpstreamConfig();
      const oldMode = currentConfig.mode;

      // Build new config
      const newConfig = {
        mode,
        dotProviders: [] as typeof currentConfig.dotProviders,
        dohProviders: [] as typeof currentConfig.dohProviders,
      };

      // Parse upstreams
      if (upstreams) {
        for (const upstream of upstreams) {
          if (upstream.type === 'dot') {
            // Parse address (ip:port format)
            const [addr, portStr] = upstream.address.split(':');
            const port = portStr ? parseInt(portStr, 10) : 853;

            newConfig.dotProviders.push({
              id: upstream.id || `dot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: upstream.name || addr,
              address: addr,
              port,
              enabled: upstream.enabled,
              priority: upstream.priority || 50,
            });
          } else if (upstream.type === 'doh') {
            newConfig.dohProviders.push({
              id: upstream.id || `doh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: upstream.name || new URL(upstream.address).hostname,
              endpointUrl: upstream.address,
              enabled: upstream.enabled,
              priority: upstream.priority || 50,
            });
          }
        }
      }

      // Apply with safe workflow
      const result = await configManager.applyUpstreamConfig(newConfig);

      if (!result.success) {
        logConfigApply(ip, user, { mode, upstreams }, false, result.error);
        logConfigRollback(ip, user, result.error || 'Apply failed');

        throw new ServiceError(result.error || 'Failed to apply configuration');
      }

      // Log success
      logConfigApply(ip, user, { mode, upstreamsCount: upstreams?.length || 0 }, true);

      if (oldMode !== mode) {
        logModeChange(ip, user, oldMode, mode);
      }

      logUpstreamChange(ip, user, { mode, upstreams: upstreams?.length || 0 });

      return {
        success: true,
        data: {
          applied: true,
          snapshotId: result.snapshotId,
          selfTestPassed: true,
        },
      };
    }
  );

  /**
   * POST /api/self-test
   */
  fastify.post(
    '/self-test',
    { preHandler: authHook },
    async () => {
      const result = await selfTest.runSelfTest();

      return {
        success: true,
        data: {
          passed: result.passed,
          steps: result.steps.map(step => ({
            name: step.name,
            passed: step.status === 'pass',
            duration: step.durationMs,
            error: step.status === 'fail' ? step.details : undefined,
          })),
          totalDuration: result.totalDuration,
        },
      };
    }
  );
}
