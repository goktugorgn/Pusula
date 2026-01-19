/**
 * Fastify Server Configuration
 */

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config/index.js';
import { initLockoutManager, shutdownLockoutManager } from './security/lockout.js';
import { startAlertEngine, stopAlertEngine } from './services/alertEngine.js';
import { AppError } from './utils/errors.js';

// Routes
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import unboundRoutes from './routes/unbound.js';
import upstreamRoutes from './routes/upstream.js';
import alertRoutes from './routes/alerts.js';
import piholeRoutes from './routes/pihole.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export async function buildServer() {
  const config = loadConfig();

  // Initialize Fastify
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Initialize lockout manager
  initLockoutManager({
    threshold: config.lockout.threshold,
    durationMs: config.lockout.durationMs,
    extendedThreshold: config.lockout.extendedThreshold,
    extendedDurationMs: config.lockout.extendedDurationMs,
  });

  // Register plugins
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // Rate limiting for API
  await fastify.register(fastifyRateLimit, {
    max: config.rateLimit.api.max,
    timeWindow: config.rateLimit.api.windowMs,
  });

  // Serve static files (frontend) if available
  // In production, UI is at /opt/pusula/apps/ui/dist
  // This path is relative to /opt/pusula/apps/backend/dist/
  const frontendPath = process.env.UI_STATIC_PATH || join(__dirname, '../../ui/dist');
  if (existsSync(frontendPath)) {
    await fastify.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
      decorateReply: false, // Allow setNotFoundHandler to work
    });

    // SPA fallback: serve index.html for all non-API routes (client-side routing)
    fastify.setNotFoundHandler((request, reply) => {
      // Don't serve index.html for API routes
      if (request.url.startsWith('/api')) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Route ${request.method}:${request.url} not found`,
          },
        });
      }

      // Serve index.html for all other routes (React Router handles them)
      return reply.sendFile('index.html');
    });
  }

  // API routes under /api prefix
  await fastify.register(
    async (api) => {
      // Auth routes with stricter rate limit for login
      await api.register(async (authScope) => {
        // Strict rate limit for login: 5/min per IP
        await authScope.register(fastifyRateLimit, {
          max: config.rateLimit.login.max,
          timeWindow: config.rateLimit.login.windowMs,
          keyGenerator: (request) => {
            // Rate limit by IP
            const forwarded = request.headers['x-forwarded-for'];
            if (forwarded) {
              const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
              return ips.split(',')[0].trim();
            }
            return request.ip;
          },
          errorResponseBuilder: () => ({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many login attempts. Please try again later.',
            },
          }),
        });
        await authScope.register(authRoutes);
      });

      await api.register(healthRoutes);
      await api.register(unboundRoutes);
      await api.register(upstreamRoutes);
      await api.register(alertRoutes);
      await api.register(piholeRoutes);
    },
    { prefix: '/api' }
  );

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    // Log unexpected errors
    request.log.error(error);

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
      },
    });
  });

  // Graceful shutdown hooks
  fastify.addHook('onClose', async () => {
    shutdownLockoutManager();
    stopAlertEngine();
  });

  // Start alert engine
  startAlertEngine();

  return fastify;
}

export default buildServer;
