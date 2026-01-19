/**
 * Configuration loader
 * Reads YAML config file and environment variables
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  appConfigSchema,
  credentialsSchema,
  upstreamConfigSchema,
  type AppConfig,
  type Credentials,
  type UpstreamConfig,
} from './schema.js';

// Cached configuration
let cachedConfig: AppConfig | null = null;
let cachedCredentials: Credentials | null = null;
let cachedUpstream: UpstreamConfig | null = null;

/**
 * Load and validate app configuration
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  // Priority: env var > /etc/pusula/config.yaml > local config.yaml
  const configPaths = [
    process.env.CONFIG_PATH,
    '/etc/pusula/config.yaml',
    './config.yaml',
  ].filter(Boolean) as string[];

  let rawConfig = {};

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        rawConfig = parseYaml(content) || {};
        console.log(`Loaded config from ${configPath}`);
        break;
      } catch (err) {
        console.error(`Failed to read config from ${configPath}:`, err);
      }
    }
  }

  // Apply environment variable overrides
  const merged = {
    ...rawConfig,
    server: {
      ...(rawConfig as any).server,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
      host: process.env.HOST,
    },
    unbound: {
      ...(rawConfig as any).unbound,
      managedIncludePath: process.env.UNBOUND_MANAGED_CONF,
    },
    pihole: {
      ...(rawConfig as any).pihole,
      enabled: process.env.PIHOLE_ENABLED === 'true',
      baseUrl: process.env.PIHOLE_BASE_URL,
      apiToken: process.env.PIHOLE_API_TOKEN,
    },
  };

  // Filter undefined values
  const cleanMerged = JSON.parse(JSON.stringify(merged));
  cachedConfig = appConfigSchema.parse(cleanMerged);

  return cachedConfig;
}

/**
 * Load and validate credentials
 */
export function loadCredentials(): Credentials {
  if (cachedCredentials) return cachedCredentials;

  // Priority: env var > /etc/pusula/credentials.json > local credentials.json
  const credentialsPaths = [
    process.env.CREDENTIALS_PATH,
    '/etc/pusula/credentials.json',
    './credentials.json',
  ].filter(Boolean) as string[];

  for (const credentialsPath of credentialsPaths) {
    if (existsSync(credentialsPath)) {
      try {
        const content = readFileSync(credentialsPath, 'utf-8');
        const data = JSON.parse(content);
        cachedCredentials = credentialsSchema.parse(data);
        console.log(`Loaded credentials from ${credentialsPath}`);
        return cachedCredentials;
      } catch (err) {
        console.error(`Failed to load credentials from ${credentialsPath}:`, err);
      }
    }
  }

  throw new Error('Credentials file not found');
}

/**
 * Load upstream configuration
 */
export function loadUpstreamConfig(): UpstreamConfig {
  if (cachedUpstream) return cachedUpstream;

  const upstreamPath =
    process.env.UPSTREAM_PATH || '/var/lib/pusula/upstream.json';

  if (!existsSync(upstreamPath)) {
    // Return default if file doesn't exist
    cachedUpstream = upstreamConfigSchema.parse({});
    return cachedUpstream;
  }

  try {
    const content = readFileSync(upstreamPath, 'utf-8');
    const data = JSON.parse(content);
    cachedUpstream = upstreamConfigSchema.parse(data);
    return cachedUpstream;
  } catch (err) {
    console.error('Failed to load upstream config, using defaults:', err);
    cachedUpstream = upstreamConfigSchema.parse({});
    return cachedUpstream;
  }
}

/**
 * Clear cached configurations (for testing or reload)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedCredentials = null;
  cachedUpstream = null;
}

/**
 * Invalidate upstream cache (after successful apply)
 */
export function invalidateUpstreamCache(): void {
  cachedUpstream = null;
}

// Export schemas for use in routes
export * from './schema.js';
