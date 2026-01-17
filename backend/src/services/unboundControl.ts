/**
 * Unbound control service
 * 
 * Wrapper for unbound-control and systemctl commands
 */

import { safeExec } from '../utils/safeExec.js';
import { ServiceError } from '../utils/errors.js';
import { loadUpstreamConfig } from '../config/index.js';

export interface UnboundStatus {
  running: boolean;
  uptime: number;
  version: string;
  mode: 'recursive' | 'dot' | 'doh';
}

export interface UnboundStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  servfailCount: number;
  nxdomainCount: number;
  avgResponseTime: number;
}

/**
 * Get Unbound service status
 */
export async function getStatus(): Promise<UnboundStatus> {
  // Check if service is running
  const isActiveResult = await safeExec('systemctl-is-active', { SERVICE: 'unbound' });
  const running = isActiveResult.stdout.trim() === 'active';

  if (!running) {
    const upstreamConfig = loadUpstreamConfig();
    return {
      running: false,
      uptime: 0,
      version: 'unknown',
      mode: upstreamConfig.mode,
    };
  }

  // Get detailed status
  const statusResult = await safeExec('unbound-status');
  
  // Parse status output
  const lines = statusResult.stdout.split('\n');
  let uptime = 0;
  let version = 'unknown';

  for (const line of lines) {
    if (line.includes('uptime')) {
      // Parse "uptime: 123 seconds"
      const match = line.match(/uptime[:\s]+(\d+)/);
      if (match) {
        uptime = parseInt(match[1], 10);
      }
    }
    if (line.includes('version')) {
      const match = line.match(/version[:\s]+(\S+)/);
      if (match) {
        version = match[1];
      }
    }
  }

  const upstreamConfig = loadUpstreamConfig();

  return {
    running,
    uptime,
    version,
    mode: upstreamConfig.mode,
  };
}

/**
 * Get Unbound statistics
 */
export async function getStats(): Promise<UnboundStats> {
  const result = await safeExec('unbound-stats');
  
  if (result.exitCode !== 0) {
    throw new ServiceError('Failed to get Unbound stats');
  }

  // Parse stats output (key=value format)
  const stats: Record<string, number> = {};
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(\S+)=(\d+\.?\d*)/);
    if (match) {
      stats[match[1]] = parseFloat(match[2]);
    }
  }

  // Calculate derived metrics
  const cacheHits = stats['total.num.cachehits'] || 0;
  const cacheMisses = stats['total.num.cachemiss'] || 0;
  const totalQueries = cacheHits + cacheMisses;
  const cacheHitRatio = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

  return {
    totalQueries: Math.round(stats['total.num.queries'] || totalQueries),
    cacheHits: Math.round(cacheHits),
    cacheMisses: Math.round(cacheMisses),
    cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
    servfailCount: Math.round(stats['total.num.answer.rcode.SERVFAIL'] || 0),
    nxdomainCount: Math.round(stats['total.num.answer.rcode.NXDOMAIN'] || 0),
    avgResponseTime: Math.round((stats['total.recursion.time.avg'] || 0) * 1000), // Convert to ms
  };
}

/**
 * Reload Unbound configuration
 */
export async function reload(): Promise<boolean> {
  const result = await safeExec('unbound-reload');
  return result.exitCode === 0;
}

/**
 * Restart Unbound service
 */
export async function restart(): Promise<boolean> {
  const result = await safeExec('systemctl-restart', { SERVICE: 'unbound' });
  return result.exitCode === 0;
}

/**
 * Flush DNS cache (all zones)
 */
export async function flushAll(): Promise<boolean> {
  const result = await safeExec('unbound-flush-all');
  return result.exitCode === 0;
}

/**
 * Flush specific zone from cache
 */
export async function flushZone(zone: string): Promise<boolean> {
  const result = await safeExec('unbound-flush-zone', { ZONE: zone });
  return result.exitCode === 0;
}

/**
 * Validate Unbound configuration
 */
export async function checkConfig(): Promise<{ valid: boolean; error?: string }> {
  const result = await safeExec('unbound-checkconf');
  
  if (result.exitCode === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    error: result.stderr || result.stdout || 'Configuration validation failed',
  };
}

/**
 * Check if Unbound is running
 */
export async function isRunning(): Promise<boolean> {
  const result = await safeExec('systemctl-is-active', { SERVICE: 'unbound' });
  return result.stdout.trim() === 'active';
}
