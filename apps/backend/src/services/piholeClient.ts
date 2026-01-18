/**
 * Pi-hole API Client
 * Read-only integration for dashboard stats
 */

import { loadConfig } from '../config/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PiholeSummary {
  configured: true;
  status: 'enabled' | 'disabled' | 'unknown';
  totalQueries: number;
  blockedQueries: number;
  percentBlocked: number;
  domainsBeingBlocked: number;
  gravityLastUpdated: string | null;
}

export interface PiholeNotConfigured {
  configured: false;
  guidance: string;
}

export type PiholeResult = PiholeSummary | PiholeNotConfigured;

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 5000;

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Check if Pi-hole integration is configured
 */
export function isPiholeConfigured(): boolean {
  const config = loadConfig();
  return config.pihole.enabled && !!config.pihole.baseUrl;
}

/**
 * Get Pi-hole configuration details
 */
export function getPiholeConfig(): { enabled: boolean; baseUrl: string } {
  const config = loadConfig();
  return {
    enabled: config.pihole.enabled,
    baseUrl: config.pihole.baseUrl,
  };
}

/**
 * Fetch Pi-hole summary statistics
 */
export async function getPiholeSummary(): Promise<PiholeResult> {
  const config = loadConfig();

  // Not configured - return guidance
  if (!config.pihole.enabled || !config.pihole.baseUrl) {
    return {
      configured: false,
      guidance: 'Pi-hole integration is not configured. Set pihole.enabled: true and pihole.baseUrl in config.yaml.',
    };
  }

  try {
    // Build API URL
    const url = new URL('/admin/api.php', config.pihole.baseUrl);
    url.searchParams.set('summary', '');

    if (config.pihole.apiToken) {
      url.searchParams.set('auth', config.pihole.apiToken);
    }

    // Make request with timeout
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Pi-hole API returned ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Parse gravity timestamp
    let gravityLastUpdated: string | null = null;
    const gravityData = data.gravity_last_updated as Record<string, unknown> | undefined;
    if (gravityData?.absolute) {
      const timestamp = parseInt(String(gravityData.absolute), 10);
      if (!isNaN(timestamp)) {
        gravityLastUpdated = new Date(timestamp * 1000).toISOString();
      }
    }

    return {
      configured: true,
      status: data.status === 'enabled' ? 'enabled' : data.status === 'disabled' ? 'disabled' : 'unknown',
      totalQueries: parseInt(String(data.dns_queries_today || '0'), 10),
      blockedQueries: parseInt(String(data.ads_blocked_today || '0'), 10),
      percentBlocked: parseFloat(String(data.ads_percentage_today || '0')),
      domainsBeingBlocked: parseInt(String(data.domains_being_blocked || '0'), 10),
      gravityLastUpdated,
    };
  } catch (err) {
    // Log error but don't expose internals
    console.error('Pi-hole API error:', err instanceof Error ? err.message : String(err));

    // Return error as configured but failed
    throw err;
  }
}

// For backward compatibility
export function isPiholeEnabled(): boolean {
  return isPiholeConfigured();
}

export default {
  isPiholeConfigured,
  isPiholeEnabled,
  getPiholeConfig,
  getPiholeSummary,
};
