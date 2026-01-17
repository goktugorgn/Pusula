/**
 * Configuration validation schemas using Zod
 */

import { z } from 'zod';

// Server configuration schema
export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  https: z.object({
    enabled: z.boolean().default(false),
    certPath: z.string().optional(),
    keyPath: z.string().optional(),
  }).default({}),
});

// Unbound configuration schema
export const unboundConfigSchema = z.object({
  mainConfigPath: z.string().default('/etc/unbound/unbound.conf'),
  managedIncludePath: z.string().default('/etc/unbound/unbound-ui-managed.conf'),
  controlSocket: z.string().optional(),
});

// DoH proxy configuration schema
export const dohProxyConfigSchema = z.object({
  type: z.enum(['cloudflared', 'dnscrypt-proxy']).default('cloudflared'),
  serviceName: z.string().default('cloudflared'),
  listenPort: z.number().int().default(5053),
});

// Pi-hole configuration schema
export const piholeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().url().default('http://localhost/admin/api.php'),
  apiToken: z.string().optional(),
});

// Rate limiting configuration schema
export const rateLimitConfigSchema = z.object({
  login: z.object({
    max: z.number().int().default(5),
    windowMs: z.number().int().default(60000), // 1 minute
  }).default({}),
  api: z.object({
    max: z.number().int().default(60),
    windowMs: z.number().int().default(60000), // 1 minute
  }).default({}),
});

// Lockout configuration schema
export const lockoutConfigSchema = z.object({
  threshold: z.number().int().default(5),
  durationMs: z.number().int().default(900000), // 15 minutes
  extendedThreshold: z.number().int().default(10),
  extendedDurationMs: z.number().int().default(3600000), // 1 hour
});

// Main application configuration schema
export const appConfigSchema = z.object({
  server: serverConfigSchema.default({}),
  unbound: unboundConfigSchema.default({}),
  dohProxy: dohProxyConfigSchema.default({}),
  pihole: piholeConfigSchema.default({}),
  rateLimit: rateLimitConfigSchema.default({}),
  lockout: lockoutConfigSchema.default({}),
  jwtSecret: z.string().min(32),
  tokenExpiry: z.string().default('24h'),
  backupDir: z.string().default('/var/lib/unbound-ui/backups'),
  auditLogPath: z.string().default('/var/log/unbound-ui/audit.log'),
  upstreamPath: z.string().default('/var/lib/unbound-ui/upstream.json'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

// Credentials schema
export const credentialsSchema = z.object({
  username: z.string().min(1),
  passwordHash: z.string().min(1),
});

export type Credentials = z.infer<typeof credentialsSchema>;

// Upstream provider schemas
export const dotProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().ip(),
  port: z.number().int().default(853),
  sni: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
});

export const dohProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  endpointUrl: z.string().url(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
});

export const upstreamConfigSchema = z.object({
  mode: z.enum(['recursive', 'dot', 'doh']).default('recursive'),
  dotProviders: z.array(dotProviderSchema).default([]),
  dohProviders: z.array(dohProviderSchema).default([]),
});

export type UpstreamConfig = z.infer<typeof upstreamConfigSchema>;

// Request validation schemas
export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

export const flushRequestSchema = z.object({
  type: z.enum(['zone', 'all']).default('all'),
  zone: z.string().optional(),
});

export const logsQuerySchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const upstreamUpdateSchema = z.object({
  mode: z.enum(['recursive', 'dot', 'doh']),
  upstreams: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['dot', 'doh']),
    address: z.string(),
    name: z.string().optional(),
    enabled: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).optional(),
  })).optional(),
});

export const alertAckRequestSchema = z.object({
  alertId: z.string().min(1),
});
