/**
 * Pi-hole API Client
 * Read-only integration for dashboard stats
 */

import { loadConfig } from '../config/index.js';

export interface PiholeSummary {
  status: 'enabled' | 'disabled' | 'unknown';
  totalQueries: number;
  blockedQueries: number;
  blockPercentage: number;
  domainsOnBlocklist: number;
}

/**
 * Fetch Pi-hole summary statistics
 */
export async function getPiholeSummary(): Promise<PiholeSummary | null> {
  const config = loadConfig();

  if (!config.pihole.enabled) {
    return null;
  }

  try {
    const url = new URL(config.pihole.baseUrl);
    url.searchParams.set('summary', '');

    if (config.pihole.apiToken) {
      url.searchParams.set('auth', config.pihole.apiToken);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('Pi-hole API error:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      status: data.status === 'enabled' ? 'enabled' : data.status === 'disabled' ? 'disabled' : 'unknown',
      totalQueries: parseInt(data.dns_queries_today || '0', 10),
      blockedQueries: parseInt(data.ads_blocked_today || '0', 10),
      blockPercentage: parseFloat(data.ads_percentage_today || '0'),
      domainsOnBlocklist: parseInt(data.domains_being_blocked || '0', 10),
    };
  } catch (err) {
    console.error('Failed to fetch Pi-hole summary:', err);
    return null;
  }
}

/**
 * Check if Pi-hole integration is enabled
 */
export function isPiholeEnabled(): boolean {
  const config = loadConfig();
  return config.pihole.enabled;
}

export default {
  getPiholeSummary,
  isPiholeEnabled,
};
