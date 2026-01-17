/**
 * Unbound Control Service
 * Wrapper for unbound-control and systemctl commands
 */

import { safeExec } from '../utils/safeExec.js';
import { ServiceError } from '../utils/errors.js';

export interface UnboundStatus {
  running: boolean;
  uptime: number;
  version: string;
  pid?: number;
}

export interface UnboundStats {
  // Core metrics
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;

  // Additional metrics
  prefetchCount: number;
  recursiveReplies: number;
  servfailCount: number;
  nxdomainCount: number;
  avgResponseTimeMs: number;

  // Raw stats map for UI flexibility
  rawStats: Record<string, number>;
}

/**
 * Check if Unbound service is active
 */
export async function isUnboundRunning(): Promise<boolean> {
  try {
    const result = await safeExec('systemctl-is-active', { SERVICE: 'unbound' });
    return result.stdout.trim() === 'active';
  } catch {
    return false;
  }
}

/**
 * Get Unbound status
 */
export async function getUnboundStatus(): Promise<UnboundStatus> {
  const running = await isUnboundRunning();

  if (!running) {
    return {
      running: false,
      uptime: 0,
      version: 'unknown',
    };
  }

  try {
    const result = await safeExec('unbound-status');

    // Parse status output
    const lines = result.stdout.split('\n');
    let uptime = 0;
    let version = 'unknown';
    let pid: number | undefined;

    for (const line of lines) {
      if (line.includes('uptime')) {
        const match = line.match(/(\d+)\s*seconds/);
        if (match) {
          uptime = parseInt(match[1], 10);
        }
      }
      if (line.includes('version')) {
        const match = line.match(/version\s+(\S+)/);
        if (match) {
          version = match[1];
        }
      }
      if (line.includes('pid')) {
        const match = line.match(/pid\s+(\d+)/);
        if (match) {
          pid = parseInt(match[1], 10);
        }
      }
    }

    return { running: true, uptime, version, pid };
  } catch (err) {
    return {
      running: true,
      uptime: 0,
      version: 'unknown',
    };
  }
}

/**
 * Get Unbound statistics
 */
export async function getUnboundStats(): Promise<UnboundStats> {
  try {
    const result = await safeExec('unbound-stats');
    return parseStats(result.stdout);
  } catch (err) {
    throw new ServiceError('Failed to get Unbound statistics');
  }
}

/**
 * Parse stats output into structured data
 * Exported for unit testing
 */
export function parseStats(output: string): UnboundStats {
  const rawStats: Record<string, number> = {};

  // Parse all key=value pairs into rawStats
  const lines = output.split('\n');
  for (const line of lines) {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim();
      const valueStr = line.slice(eqIndex + 1).trim();
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        rawStats[key] = value;
      }
    }
  }

  // Extract specific metrics (with fallback to 0)
  const totalQueries = rawStats['total.num.queries'] ?? 0;
  const cacheHits = rawStats['total.num.cachehits'] ?? 0;
  const cacheMisses = rawStats['total.num.cachemiss'] ?? 0;
  const prefetchCount = rawStats['total.num.prefetch'] ?? 0;
  const recursiveReplies = rawStats['total.num.recursivereplies'] ?? 0;
  const servfailCount = rawStats['num.answer.rcode.SERVFAIL'] ?? 0;
  const nxdomainCount = rawStats['num.answer.rcode.NXDOMAIN'] ?? 0;
  const avgResponseTimeSec = rawStats['total.recursion.time.avg'] ?? 0;

  // Calculate cache hit ratio
  const cacheHitRatio = totalQueries > 0
    ? (cacheHits / totalQueries) * 100
    : 0;

  return {
    totalQueries,
    cacheHits,
    cacheMisses,
    cacheHitRatio,
    prefetchCount,
    recursiveReplies,
    servfailCount,
    nxdomainCount,
    avgResponseTimeMs: avgResponseTimeSec * 1000,
    rawStats,
  };
}

/**
 * Reload Unbound configuration
 */
export async function reloadUnbound(): Promise<void> {
  try {
    await safeExec('unbound-reload');
  } catch (err) {
    throw new ServiceError('Failed to reload Unbound configuration');
  }
}

/**
 * Restart Unbound service
 */
export async function restartUnbound(): Promise<void> {
  try {
    await safeExec('systemctl-restart', { SERVICE: 'unbound' });
  } catch (err) {
    throw new ServiceError('Failed to restart Unbound service');
  }
}

/**
 * Flush DNS cache (all zones)
 */
export async function flushAllCache(): Promise<void> {
  try {
    await safeExec('unbound-flush-all');
  } catch (err) {
    throw new ServiceError('Failed to flush DNS cache');
  }
}

/**
 * Flush a specific zone
 */
export async function flushZone(zone: string): Promise<void> {
  try {
    await safeExec('unbound-flush-zone', { ZONE: zone });
  } catch (err) {
    throw new ServiceError(`Failed to flush zone: ${zone}`);
  }
}

/**
 * Validate Unbound configuration
 */
export async function checkConfig(filePath?: string): Promise<boolean> {
  try {
    if (filePath) {
      await safeExec('unbound-checkconf-file', { FILE: filePath });
    } else {
      await safeExec('unbound-checkconf');
    }
    return true;
  } catch {
    return false;
  }
}

export default {
  isUnboundRunning,
  getUnboundStatus,
  getUnboundStats,
  reloadUnbound,
  restartUnbound,
  flushAllCache,
  flushZone,
  checkConfig,
};
