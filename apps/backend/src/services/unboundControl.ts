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
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  servfailCount: number;
  nxdomainCount: number;
  avgResponseTime: number;
  numQueries: number;
  numCacheMiss: number;
}

/**
 * Check if Unbound service is active
 */
export async function isUnboundRunning(): Promise<boolean> {
  try {
    const result = await safeExec('systemctl-is-active', { SERVICE: 'unbound' });
    return result.trim() === 'active';
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
    const output = await safeExec('unbound-status');

    // Parse status output
    const lines = output.split('\n');
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
    const output = await safeExec('unbound-stats');
    return parseStats(output);
  } catch (err) {
    throw new ServiceError('Failed to get Unbound statistics');
  }
}

/**
 * Parse stats output into structured data
 */
function parseStats(output: string): UnboundStats {
  const stats: UnboundStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRatio: 0,
    servfailCount: 0,
    nxdomainCount: 0,
    avgResponseTime: 0,
    numQueries: 0,
    numCacheMiss: 0,
  };

  const lines = output.split('\n');

  for (const line of lines) {
    const [key, value] = line.split('=').map((s) => s.trim());
    const numValue = parseFloat(value);

    if (key === 'total.num.queries') {
      stats.totalQueries = numValue;
      stats.numQueries = numValue;
    } else if (key === 'total.num.cachehits') {
      stats.cacheHits = numValue;
    } else if (key === 'total.num.cachemiss') {
      stats.cacheMisses = numValue;
      stats.numCacheMiss = numValue;
    } else if (key === 'num.answer.rcode.SERVFAIL') {
      stats.servfailCount = numValue;
    } else if (key === 'num.answer.rcode.NXDOMAIN') {
      stats.nxdomainCount = numValue;
    } else if (key === 'total.recursion.time.avg') {
      stats.avgResponseTime = numValue * 1000; // Convert to ms
    }
  }

  // Calculate hit ratio
  if (stats.totalQueries > 0) {
    stats.cacheHitRatio = (stats.cacheHits / stats.totalQueries) * 100;
  }

  return stats;
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
