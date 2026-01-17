/**
 * Pi-hole client
 * 
 * Read-only integration with Pi-hole API
 */

import { getConfig } from '../config/index.js';

export interface PiholeSummary {
  status: 'enabled' | 'disabled' | 'unknown';
  totalQueries: number;
  blockedQueries: number;
  blockPercentage: number;
  domainsOnBlocklist: number;
}

interface PiholeApiResponse {
  status?: string;
  dns_queries_today?: number;
  ads_blocked_today?: number;
  ads_percentage_today?: number;
  domains_being_blocked?: number;
  // Additional fields we might use later
  unique_clients?: number;
  queries_forwarded?: number;
  queries_cached?: number;
}

/**
 * Fetch Pi-hole summary statistics
 */
export async function getSummary(): Promise<PiholeSummary | null> {
  const config = getConfig();
  
  if (!config.pihole.enabled) {
    return null;
  }

  try {
    const url = new URL(config.pihole.baseUrl);
    url.searchParams.set('summaryRaw', '');
    
    if (config.pihole.apiToken) {
      url.searchParams.set('auth', config.pihole.apiToken);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Pi-hole API returned ${response.status}`);
      return getDefaultSummary('unknown');
    }

    const data: PiholeApiResponse = await response.json();

    return {
      status: data.status === 'enabled' ? 'enabled' : data.status === 'disabled' ? 'disabled' : 'unknown',
      totalQueries: data.dns_queries_today || 0,
      blockedQueries: data.ads_blocked_today || 0,
      blockPercentage: Math.round((data.ads_percentage_today || 0) * 100) / 100,
      domainsOnBlocklist: data.domains_being_blocked || 0,
    };
  } catch (error) {
    console.warn('Failed to fetch Pi-hole summary:', error);
    return getDefaultSummary('unknown');
  }
}

/**
 * Check if Pi-hole is reachable
 */
export async function isReachable(): Promise<boolean> {
  const config = getConfig();
  
  if (!config.pihole.enabled) {
    return false;
  }

  try {
    const response = await fetch(config.pihole.baseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get default summary for error cases
 */
function getDefaultSummary(status: 'enabled' | 'disabled' | 'unknown'): PiholeSummary {
  return {
    status,
    totalQueries: 0,
    blockedQueries: 0,
    blockPercentage: 0,
    domainsOnBlocklist: 0,
  };
}

/**
 * Get top blocked domains (if API supports it)
 */
export async function getTopBlocked(count: number = 10): Promise<string[]> {
  const config = getConfig();
  
  if (!config.pihole.enabled || !config.pihole.apiToken) {
    return [];
  }

  try {
    const url = new URL(config.pihole.baseUrl);
    url.searchParams.set('topItems', String(count));
    url.searchParams.set('auth', config.pihole.apiToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    // Pi-hole returns { top_ads: { domain: count, ... } }
    if (data.top_ads && typeof data.top_ads === 'object') {
      return Object.keys(data.top_ads).slice(0, count);
    }

    return [];
  } catch {
    return [];
  }
}
