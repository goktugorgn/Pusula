/**
 * Configuration loader
 * 
 * Loads configuration from YAML files and environment variables
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import {
  appConfigSchema,
  credentialsSchema,
  upstreamConfigSchema,
  type AppConfig,
  type Credentials,
  type UpstreamConfig,
} from './schema.js';

// Default paths
const DEFAULT_PATHS = {
  config: process.env.CONFIG_PATH || '/etc/unbound-ui/config.yaml',
  credentials: process.env.CREDENTIALS_PATH || '/etc/unbound-ui/credentials.json',
  upstream: process.env.UPSTREAM_PATH || '/var/lib/unbound-ui/upstream.json',
};

let cachedConfig: AppConfig | null = null;
let cachedCredentials: Credentials | null = null;

/**
 * Load and validate application configuration
 */
export function loadConfig(configPath?: string): AppConfig {
  if (cachedConfig && !configPath) {
    return cachedConfig;
  }

  const path = configPath || DEFAULT_PATHS.config;
  
  let rawConfig: Record<string, unknown> = {};

  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    rawConfig = parseYaml(content) as Record<string, unknown>;
  }

  // Override with environment variables
  const envOverrides: Record<string, unknown> = {
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
      host: process.env.HOST,
    },
    jwtSecret: process.env.JWT_SECRET,
    backupDir: process.env.BACKUP_DIR,
    auditLogPath: process.env.AUDIT_LOG_PATH,
    upstreamPath: process.env.UPSTREAM_PATH,
    unbound: {
      managedIncludePath: process.env.UNBOUND_MANAGED_CONF,
    },
    pihole: {
      baseUrl: process.env.PIHOLE_URL,
      apiToken: process.env.PIHOLE_TOKEN,
    },
  };

  // Deep merge config with env overrides
  const mergedConfig = deepMerge(rawConfig, envOverrides);

  // Validate and parse
  const result = appConfigSchema.safeParse(mergedConfig);
  
  if (!result.success) {
    throw new Error(`Configuration validation failed: ${result.error.message}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Load and validate credentials
 */
export function loadCredentials(credentialsPath?: string): Credentials {
  if (cachedCredentials && !credentialsPath) {
    return cachedCredentials;
  }

  const path = credentialsPath || DEFAULT_PATHS.credentials;

  if (!existsSync(path)) {
    throw new Error(`Credentials file not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const rawCredentials = JSON.parse(content);

  const result = credentialsSchema.safeParse(rawCredentials);
  
  if (!result.success) {
    throw new Error(`Credentials validation failed: ${result.error.message}`);
  }

  cachedCredentials = result.data;
  return cachedCredentials;
}

/**
 * Load upstream configuration
 */
export function loadUpstreamConfig(upstreamPath?: string): UpstreamConfig {
  const config = loadConfig();
  const path = upstreamPath || config.upstreamPath;

  if (!existsSync(path)) {
    // Return default config if file doesn't exist
    return upstreamConfigSchema.parse({});
  }

  const content = readFileSync(path, 'utf-8');
  const rawConfig = JSON.parse(content);

  const result = upstreamConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    throw new Error(`Upstream config validation failed: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Deep merge utility for config objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue === undefined || sourceValue === null) {
      continue;
    }

    if (
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Clear config cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedCredentials = null;
}

/**
 * Get current config (throws if not loaded)
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

// Re-export types
export type { AppConfig, Credentials, UpstreamConfig };
