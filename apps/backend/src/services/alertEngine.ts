/**
 * Alert Engine
 * Monitors thresholds and creates persisted alerts
 */

import {
  createAlert,
  resolveAlertsByRule,
  updateLastCheck,
  type AlertRule,
} from './alertStore.js';
import { getUnboundStats, isUnboundRunning } from './unboundControl.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AlertThresholds {
  servfailRateCritical: number;  // %
  servfailRateWarning: number;   // %
  cacheHitRatioWarning: number;  // %
  checkIntervalSeconds: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  servfailRateCritical: 20,
  servfailRateWarning: 10,
  cacheHitRatioWarning: 30,
  checkIntervalSeconds: 60,
};

let thresholds = { ...DEFAULT_THRESHOLDS };
let checkInterval: NodeJS.Timeout | null = null;
let previousStats: { servfailCount: number; totalQueries: number } | null = null;

// ============================================================================
// ENGINE CONTROL
// ============================================================================

/**
 * Configure alert thresholds
 */
export function configureThresholds(newThresholds: Partial<AlertThresholds>): void {
  thresholds = { ...thresholds, ...newThresholds };
}

/**
 * Get current thresholds
 */
export function getThresholds(): AlertThresholds {
  return { ...thresholds };
}

/**
 * Start the alert engine
 */
export function startAlertEngine(): void {
  if (checkInterval) return;

  // Run initial check
  runChecks().catch(console.error);

  // Check at interval
  checkInterval = setInterval(() => {
    runChecks().catch(console.error);
  }, thresholds.checkIntervalSeconds * 1000);

  console.log(`Alert engine started (interval: ${thresholds.checkIntervalSeconds}s)`);
}

/**
 * Stop the alert engine
 */
export function stopAlertEngine(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Alert engine stopped');
  }
}

/**
 * Check if engine is running
 */
export function isEngineRunning(): boolean {
  return checkInterval !== null;
}

// ============================================================================
// CHECK LOGIC
// ============================================================================

/**
 * Run all health checks
 */
export async function runChecks(): Promise<void> {
  try {
    await checkUnboundRunning();
    await checkServfailRate();
    await checkCacheHitRatio();
    updateLastCheck();
  } catch (err) {
    console.error('Alert engine check failed:', err);
  }
}

/**
 * Check if Unbound is running
 */
async function checkUnboundRunning(): Promise<void> {
  const rule: AlertRule = 'unbound_down';

  try {
    const running = await isUnboundRunning();

    if (!running) {
      createAlert(
        rule,
        'critical',
        'Unbound DNS Service Down',
        'The Unbound DNS resolver service is not running. DNS resolution is unavailable.'
      );
    } else {
      resolveAlertsByRule(rule);
    }
  } catch (err) {
    createAlert(
      rule,
      'critical',
      'Unbound Status Check Failed',
      `Cannot determine Unbound status: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Check SERVFAIL rate
 */
async function checkServfailRate(): Promise<void> {
  const rule: AlertRule = 'high_servfail_rate';

  try {
    const stats = await getUnboundStats();

    // Calculate rate based on delta
    let servfailRate = 0;
    if (previousStats && stats.totalQueries > previousStats.totalQueries) {
      const queryDelta = stats.totalQueries - previousStats.totalQueries;
      const servfailDelta = stats.servfailCount - previousStats.servfailCount;
      servfailRate = (servfailDelta / queryDelta) * 100;
    }

    previousStats = {
      servfailCount: stats.servfailCount,
      totalQueries: stats.totalQueries,
    };

    if (servfailRate >= thresholds.servfailRateCritical) {
      createAlert(
        rule,
        'critical',
        'Critical SERVFAIL Rate',
        `DNS SERVFAIL rate is ${servfailRate.toFixed(1)}%, exceeding ${thresholds.servfailRateCritical}% threshold.`,
        { rate: servfailRate }
      );
    } else if (servfailRate >= thresholds.servfailRateWarning) {
      createAlert(
        rule,
        'warning',
        'Elevated SERVFAIL Rate',
        `DNS SERVFAIL rate is ${servfailRate.toFixed(1)}%, exceeding ${thresholds.servfailRateWarning}% threshold.`,
        { rate: servfailRate }
      );
    } else {
      resolveAlertsByRule(rule);
    }
  } catch {
    // Handled by unbound_down
  }
}

/**
 * Check cache hit ratio
 */
async function checkCacheHitRatio(): Promise<void> {
  const rule: AlertRule = 'low_cache_hit_ratio';

  try {
    const stats = await getUnboundStats();

    if (stats.totalQueries < 100) {
      return; // Not enough data
    }

    if (stats.cacheHitRatio < thresholds.cacheHitRatioWarning) {
      createAlert(
        rule,
        'warning',
        'Low Cache Hit Ratio',
        `DNS cache hit ratio is ${stats.cacheHitRatio.toFixed(1)}%, below ${thresholds.cacheHitRatioWarning}% threshold.`,
        { ratio: stats.cacheHitRatio }
      );
    } else {
      resolveAlertsByRule(rule);
    }
  } catch {
    // Handled by other alerts
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  configureThresholds,
  getThresholds,
  startAlertEngine,
  stopAlertEngine,
  isEngineRunning,
  runChecks,
};
