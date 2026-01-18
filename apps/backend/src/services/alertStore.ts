/**
 * Alert Store
 * In-memory + JSON file persisted storage for alerts
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { atomicWriteSync } from '../utils/atomicWrite.js';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export type AlertRule =
  | 'unbound_down'
  | 'upstream_error'
  | 'high_servfail_rate'
  | 'low_cache_hit_ratio'
  | 'config_validation_failed';

export interface Alert {
  id: string;
  rule: AlertRule;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertStoreData {
  alerts: Alert[];
  lastCheck: string | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALERT_STORE_PATH = process.env.ALERT_STORE_PATH || '/var/lib/unbound-ui/alerts.json';

/** Cooldown period before re-alerting on same rule (ms) */
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// STORE
// ============================================================================

/** In-memory cache */
let store: AlertStoreData = {
  alerts: [],
  lastCheck: null,
};

/**
 * Load alerts from disk
 */
export function loadAlerts(): void {
  try {
    if (existsSync(ALERT_STORE_PATH)) {
      const data = readFileSync(ALERT_STORE_PATH, 'utf-8');
      store = JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load alerts:', err);
    store = { alerts: [], lastCheck: null };
  }
}

/**
 * Save alerts to disk
 */
export function saveAlerts(): void {
  try {
    const dir = dirname(ALERT_STORE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    atomicWriteSync(ALERT_STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Failed to save alerts:', err);
  }
}

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if alert with same rule is in cooldown
 */
function isInCooldown(rule: AlertRule): boolean {
  const existingActive = store.alerts.find(
    (a) => a.rule === rule && a.status === 'active'
  );

  if (existingActive) {
    const lastUpdate = new Date(existingActive.updatedAt).getTime();
    return Date.now() - lastUpdate < ALERT_COOLDOWN_MS;
  }

  return false;
}

// ============================================================================
// ALERT OPERATIONS
// ============================================================================

/**
 * Get all alerts
 */
export function getAlerts(options: {
  status?: AlertStatus;
  limit?: number;
} = {}): Alert[] {
  let result = [...store.alerts];

  if (options.status) {
    result = result.filter((a) => a.status === options.status);
  }

  // Sort by createdAt descending
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Get active alerts only
 */
export function getActiveAlerts(): Alert[] {
  return getAlerts({ status: 'active' });
}

/**
 * Get alert by ID
 */
export function getAlertById(id: string): Alert | undefined {
  return store.alerts.find((a) => a.id === id);
}

/**
 * Create a new alert (with deduplication)
 */
export function createAlert(
  rule: AlertRule,
  severity: AlertSeverity,
  title: string,
  message: string,
  details?: Record<string, unknown>
): Alert | null {
  // Check cooldown for deduplication
  if (isInCooldown(rule)) {
    // Update existing alert instead of creating new
    const existing = store.alerts.find(
      (a) => a.rule === rule && a.status === 'active'
    );
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      existing.details = { ...existing.details, ...details };
      saveAlerts();
      return existing;
    }
    return null;
  }

  // Resolve any existing active alerts for this rule
  store.alerts
    .filter((a) => a.rule === rule && a.status === 'active')
    .forEach((a) => {
      a.status = 'resolved';
      a.resolvedAt = new Date().toISOString();
    });

  const alert: Alert = {
    id: generateAlertId(),
    rule,
    severity,
    status: 'active',
    title,
    message,
    details,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.alerts.push(alert);
  saveAlerts();

  return alert;
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(id: string, username: string): Alert | null {
  const alert = store.alerts.find((a) => a.id === id);

  if (!alert) {
    return null;
  }

  if (alert.status !== 'active') {
    return alert; // Already acknowledged or resolved
  }

  alert.status = 'acknowledged';
  alert.acknowledgedBy = username;
  alert.acknowledgedAt = new Date().toISOString();
  alert.updatedAt = new Date().toISOString();

  saveAlerts();
  return alert;
}

/**
 * Resolve an alert
 */
export function resolveAlert(id: string): Alert | null {
  const alert = store.alerts.find((a) => a.id === id);

  if (!alert) {
    return null;
  }

  alert.status = 'resolved';
  alert.resolvedAt = new Date().toISOString();
  alert.updatedAt = new Date().toISOString();

  saveAlerts();
  return alert;
}

/**
 * Resolve alerts by rule (when condition is fixed)
 */
export function resolveAlertsByRule(rule: AlertRule): void {
  store.alerts
    .filter((a) => a.rule === rule && a.status === 'active')
    .forEach((a) => {
      a.status = 'resolved';
      a.resolvedAt = new Date().toISOString();
      a.updatedAt = new Date().toISOString();
    });

  saveAlerts();
}

/**
 * Update last check timestamp
 */
export function updateLastCheck(): void {
  store.lastCheck = new Date().toISOString();
  saveAlerts();
}

/**
 * Get last check timestamp
 */
export function getLastCheck(): string | null {
  return store.lastCheck;
}

/**
 * Clean up old resolved alerts (keep last N)
 */
export function cleanupOldAlerts(keepCount: number = 100): void {
  const resolved = store.alerts
    .filter((a) => a.status === 'resolved')
    .sort((a, b) => new Date(b.resolvedAt || b.updatedAt).getTime() - new Date(a.resolvedAt || a.updatedAt).getTime());

  if (resolved.length > keepCount) {
    const toRemove = resolved.slice(keepCount).map((a) => a.id);
    store.alerts = store.alerts.filter((a) => !toRemove.includes(a.id));
    saveAlerts();
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load alerts on module load
loadAlerts();

export default {
  loadAlerts,
  saveAlerts,
  getAlerts,
  getActiveAlerts,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  resolveAlertsByRule,
  updateLastCheck,
  getLastCheck,
  cleanupOldAlerts,
};
