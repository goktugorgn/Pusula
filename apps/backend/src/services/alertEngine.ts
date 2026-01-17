/**
 * Alert Engine
 * Monitors thresholds and emits alerts
 */

import { getUnboundStats, isUnboundRunning } from './unboundControl.js';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  timestamp: string;
}

// In-memory alert store
const activeAlerts = new Map<string, Alert>();

// Thresholds
const THRESHOLDS = {
  servfailRateCritical: 20,  // %
  servfailRateWarning: 10,   // %
  cacheHitRatioWarning: 30,  // %
};

// Check interval
let checkInterval: NodeJS.Timeout | null = null;

/**
 * Start the alert engine
 */
export function startAlertEngine(): void {
  if (checkInterval) return;

  // Check every 30 seconds
  checkInterval = setInterval(runChecks, 30000);

  // Run initial check
  runChecks();
}

/**
 * Stop the alert engine
 */
export function stopAlertEngine(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Run all health checks
 */
async function runChecks(): Promise<void> {
  await checkUnboundRunning();
  await checkServfailRate();
  await checkCacheHitRatio();
}

/**
 * Check if Unbound is running
 */
async function checkUnboundRunning(): Promise<void> {
  const alertId = 'unbound_down';

  try {
    const running = await isUnboundRunning();

    if (!running) {
      setAlert({
        id: alertId,
        severity: 'critical',
        type: 'service_down',
        message: 'Unbound DNS service is not running',
        timestamp: new Date().toISOString(),
      });
    } else {
      clearAlert(alertId);
    }
  } catch {
    setAlert({
      id: alertId,
      severity: 'critical',
      type: 'service_down',
      message: 'Cannot determine Unbound status',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Check SERVFAIL rate
 */
async function checkServfailRate(): Promise<void> {
  const alertId = 'high_servfail';

  try {
    const stats = await getUnboundStats();

    if (stats.totalQueries < 100) {
      // Not enough data
      clearAlert(alertId);
      return;
    }

    const rate = (stats.servfailCount / stats.totalQueries) * 100;

    if (rate >= THRESHOLDS.servfailRateCritical) {
      setAlert({
        id: alertId,
        severity: 'critical',
        type: 'high_error_rate',
        message: `High SERVFAIL rate: ${rate.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else if (rate >= THRESHOLDS.servfailRateWarning) {
      setAlert({
        id: alertId,
        severity: 'warning',
        type: 'high_error_rate',
        message: `Elevated SERVFAIL rate: ${rate.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else {
      clearAlert(alertId);
    }
  } catch {
    // Can't get stats, handled by unbound_down alert
  }
}

/**
 * Check cache hit ratio
 */
async function checkCacheHitRatio(): Promise<void> {
  const alertId = 'low_cache_hit';

  try {
    const stats = await getUnboundStats();

    if (stats.totalQueries < 1000) {
      // Not enough data
      clearAlert(alertId);
      return;
    }

    if (stats.cacheHitRatio < THRESHOLDS.cacheHitRatioWarning) {
      setAlert({
        id: alertId,
        severity: 'info',
        type: 'low_cache_hit',
        message: `Low cache hit ratio: ${stats.cacheHitRatio.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else {
      clearAlert(alertId);
    }
  } catch {
    // Handled by other alerts
  }
}

/**
 * Set an alert
 */
function setAlert(alert: Alert): void {
  activeAlerts.set(alert.id, alert);
}

/**
 * Clear an alert
 */
function clearAlert(alertId: string): void {
  activeAlerts.delete(alertId);
}

/**
 * Get all active alerts
 */
export function getAlerts(): Alert[] {
  return Array.from(activeAlerts.values());
}

/**
 * Acknowledge and clear an alert
 */
export function acknowledgeAlert(alertId: string): boolean {
  return activeAlerts.delete(alertId);
}

/**
 * Get alert count by severity
 */
export function getAlertCounts(): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };

  for (const alert of activeAlerts.values()) {
    counts[alert.severity]++;
  }

  return counts;
}

export default {
  startAlertEngine,
  stopAlertEngine,
  getAlerts,
  acknowledgeAlert,
  getAlertCounts,
};
