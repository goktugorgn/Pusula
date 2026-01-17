/**
 * Fastify server setup
 * 
 * Configures plugins, middleware, error handling, and routes
 */

import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getConfig, loadConfig, type AppConfig } from './config/index.js';
import { AppError, formatErrorResponse, RateLimitError } from './utils/errors.js';
import { initRateLimiters, checkApiRateLimit, shutdownRateLimiters } from './security/rateLimit.js';
import { initLockoutManager, shutdownLockoutManager } from './security/lockout.js';
import { initAuditLogger } from './security/auditLogger.js';
import { getClientIp } from './security/auth.js';
import { startMonitoring, stopMonitoring } from './services/alertEngine.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { unboundRoutes } from './routes/unbound.js';
import { upstreamRoutes } from './routes/upstream.js';
import { alertRoutes } from './routes/alerts.js';
import { piholeRoutes } from './routes/pihole.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build and configure Fastify server
 */
export async function buildServer(config?: AppConfig): Promise<FastifyInstance> {
  const appConfig = config || loadConfig();

  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    trustProxy: true,
  });

  // Initialize security components
  initRateLimiters({
    login: appConfig.rateLimit.login,
    api: appConfig.rateLimit.api,
  });

  initLockoutManager({
    threshold: appConfig.lockout.threshold,
    durationMs: appConfig.lockout.durationMs,
    extendedThreshold: appConfig.lockout.extendedThreshold,
    extendedDurationMs: appConfig.lockout.extendedDurationMs,
  });

  initAuditLogger(appConfig.auditLogPath);

  // Register plugins
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: appConfig.jwtSecret,
    cookie: {
      cookieName: 'pusula_token',
      signed: false,
    },
  });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });

  // Serve static frontend files if they exist
  const frontendPath = join(__dirname, '../../frontend/dist');
  if (existsSync(frontendPath)) {
    await fastify.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
    });
  }

  // API rate limiting hook (for authenticated routes)
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health and login endpoints
    if (request.url === '/api/health' || request.url === '/api/login') {
      return;
    }

    // Skip for static files
    if (!request.url.startsWith('/api/')) {
      return;
    }

    const ip = getClientIp(request);
    checkApiRateLimit(ip);
  });

  // Register API routes
  await fastify.register(async (api) => {
    await api.register(authRoutes);
    await api.register(healthRoutes);
    await api.register(unboundRoutes);
    await api.register(upstreamRoutes);
    await api.register(alertRoutes);
    await api.register(piholeRoutes);
  }, { prefix: '/api' });

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    // Handle Fastify validation errors
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
    fastify.log.error(error);

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
      },
    });
  });

  // Graceful shutdown hooks
  fastify.addHook('onClose', async () => {
    shutdownRateLimiters();
    shutdownLockoutManager();
    stopMonitoring();
  });

  // Start alert monitoring
  startMonitoring(30000);

  return fastify;
}

/**
 * Start the server
 */
export async function startServer(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`Server listening on http://${config.server.host}:${config.server.port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}
