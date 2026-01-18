/**
 * Zod schemas for configuration and API validation
 */

import { z } from 'zod';

// Server configuration schema
export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
});

// Rate limit configuration
export const rateLimitConfigSchema = z.object({
  login: z
    .object({
      max: z.number().int().positive().default(5),
      windowMs: z.number().int().positive().default(60000),
    })
    .default({}),
  api: z
    .object({
      max: z.number().int().positive().default(60),
      windowMs: z.number().int().positive().default(60000),
    })
    .default({}),
});

// Lockout configuration
export const lockoutConfigSchema = z.object({
  threshold: z.number().int().positive().default(5),
  durationMs: z.number().int().positive().default(900000), // 15 min
  extendedThreshold: z.number().int().positive().default(10),
  extendedDurationMs: z.number().int().positive().default(3600000), // 1 hr
});

// Unbound configuration
export const unboundConfigSchema = z.object({
  mainConfigPath: z.string().default('/etc/unbound/unbound.conf'),
  managedIncludePath: z.string().default('/etc/unbound/unbound-ui-managed.conf'),
});

// Pi-hole configuration
export const piholeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().url().default('http://localhost/admin/api.php'),
  apiToken: z.string().optional(),
});

// Full app configuration
export const appConfigSchema = z.object({
  server: serverConfigSchema.default({}),
  rateLimit: rateLimitConfigSchema.default({}),
  lockout: lockoutConfigSchema.default({}),
  unbound: unboundConfigSchema.default({}),
  pihole: piholeConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

// Credentials schema
export const credentialsSchema = z.object({
  username: z.string().min(1),
  passwordHash: z.string().min(1),
});

export type Credentials = z.infer<typeof credentialsSchema>;

// Upstream provider schema
export const upstreamProviderSchema = z.object({
  id: z.string(),
  type: z.enum(['dot', 'doh']),
  address: z.string(),
  port: z.number().int().optional(),
  sni: z.string().optional(),
  name: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().optional(),
});

export type UpstreamProvider = z.infer<typeof upstreamProviderSchema>;

// Upstream configuration schema
export const upstreamConfigSchema = z.object({
  mode: z.enum(['recursive', 'dot', 'doh']).default('recursive'),
  dotProviders: z.array(upstreamProviderSchema).default([]),
  dohProviders: z.array(upstreamProviderSchema).default([]),
});

export type UpstreamConfig = z.infer<typeof upstreamConfigSchema>;

// API Request schemas
export const loginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

export const flushCacheRequestSchema = z.object({
  type: z.enum(['zone', 'request']),
  value: z.string().min(1, 'Value is required'),
});

export const updateUpstreamRequestSchema = z.object({
  mode: z.enum(['recursive', 'dot', 'doh']),
  dotProviders: z.array(upstreamProviderSchema).optional(),
  dohProviders: z.array(upstreamProviderSchema).optional(),
  runSelfTest: z.boolean().default(true),
});

export const ackAlertRequestSchema = z.object({
  alertId: z.string().min(1),
});

// Query parameter schemas
export const logsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  level: z.enum(['error', 'warn', 'info']).optional(),
  since: z.string().optional(),
  cursor: z.string().optional(),
  follow: z.coerce.boolean().default(false),
});
