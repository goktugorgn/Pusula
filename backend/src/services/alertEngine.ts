/**
 * Alert engine
 * 
 * Monitors system health and generates alerts
 */

import { v4 as uuidv4 } from 'crypto';
import * as unboundControl from './unboundControl.js';

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

interface AlertRule {
  type: string;
  check: () => Promise<{ triggered: boolean; severity: Alert['severity']; message: string } | null>;
  cooldownMs: number;
}

// In-memory alert store
let alerts: Alert[] = [];
const lastTriggered: Map<string, number> = new Map();
let monitoringInterval: ReturnType<typeof setInterval> | null = null;

// Default thresholds
const THRESHOLDS = {
  servfailRate: 5, // SERVFAIL percentage threshold
  cacheHitRatioMin: 20, // Minimum cache hit ratio (%)
  errorSpike: 50, // Error count spike threshold
};

/**
 * Alert rules
 */
const alertRules: AlertRule[] = [
  {
    type: 'unbound_down',
    cooldownMs: 60000, // 1 minute cooldown
    check: async () => {
      const running = await unboundControl.isRunning();
      if (!running) {
        return {
          triggered: true,
          severity: 'critical',
          message: 'Unbound DNS service is not running',
        };
      }
      return null;
    },
  },
  {
    type: 'high_servfail_rate',
    cooldownMs: 300000, // 5 minute cooldown
    check: async () => {
      try {
        const stats = await unboundControl.getStats();
        const total = stats.totalQueries;
        if (total < 100) return null; // Need minimum queries

        const servfailRate = (stats.servfailCount / total) * 100;
        if (servfailRate > THRESHOLDS.servfailRate) {
          return {
            triggered: true,
            severity: 'warning',
            message: `High SERVFAIL rate: ${servfailRate.toFixed(1)}% (threshold: ${THRESHOLDS.servfailRate}%)`,
          };
        }
      } catch {
        // Ignore check errors
      }
      return null;
    },
  },
  {
    type: 'low_cache_hit_ratio',
    cooldownMs: 600000, // 10 minute cooldown
    check: async () => {
      try {
        const stats = await unboundControl.getStats();
        if (stats.totalQueries < 100) return null;

        if (stats.cacheHitRatio < THRESHOLDS.cacheHitRatioMin) {
          return {
            triggered: true,
            severity: 'info',
            message: `Low cache hit ratio: ${stats.cacheHitRatio.toFixed(1)}% (threshold: ${THRESHOLDS.cacheHitRatioMin}%)`,
          };
        }
      } catch {
        // Ignore check errors
      }
      return null;
    },
  },
];

/**
 * Create a new alert
 */
function createAlert(
  type: string,
  severity: Alert['severity'],
  message: string
): Alert {
  return {
    id: generateId(),
    severity,
    type,
    message,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };
}

/**
 * Generate alert ID
 */
function generateId(): string {
  // Simple ID generation without external dependency
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Run all alert checks
 */
export async function checkAlerts(): Promise<void> {
  const now = Date.now();

  for (const rule of alertRules) {
    // Check cooldown
    const lastTime = lastTriggered.get(rule.type) || 0;
    if (now - lastTime < rule.cooldownMs) {
      continue;
    }

    try {
      const result = await rule.check();
      if (result?.triggered) {
        // Check if there's already an active alert of this type
        const existingActive = alerts.find(
          a => a.type === rule.type && !a.acknowledged
        );

        if (!existingActive) {
          const alert = createAlert(rule.type, result.severity, result.message);
          alerts.push(alert);
          lastTriggered.set(rule.type, now);

          // Keep only last 100 alerts
          if (alerts.length > 100) {
            alerts = alerts.slice(-100);
          }
        }
      }
    } catch {
      // Ignore individual check errors
    }
  }
}

/**
 * Get active (unacknowledged) alerts
 */
export function getActiveAlerts(): Alert[] {
  return alerts.filter(a => !a.acknowledged);
}

/**
 * Get all alerts
 */
export function getAllAlerts(): Alert[] {
  return [...alerts];
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string): boolean {
  const alert = alerts.find(a => a.id === alertId);
  if (!alert) {
    return false;
  }

  alert.acknowledged = true;
  alert.acknowledgedAt = new Date().toISOString();
  return true;
}

/**
 * Start alert monitoring
 */
export function startMonitoring(intervalMs: number = 30000): void {
  if (monitoringInterval) {
    return; // Already running
  }

  monitoringInterval = setInterval(() => {
    checkAlerts().catch(console.error);
  }, intervalMs);

  // Run initial check
  checkAlerts().catch(console.error);
}

/**
 * Stop alert monitoring
 */
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

/**
 * Clear all alerts (for testing)
 */
export function clearAlerts(): void {
  alerts = [];
  lastTriggered.clear();
}

/**
 * Add a manual alert (for external triggers)
 */
export function addAlert(
  type: string,
  severity: Alert['severity'],
  message: string
): Alert {
  const alert = createAlert(type, severity, message);
  alerts.push(alert);
  return alert;
}
