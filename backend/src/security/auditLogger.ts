/**
 * Audit logger
 * 
 * Logs all state-changing actions to audit log file
 * Format: JSON lines
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'password_change'
  | 'config_apply'
  | 'config_rollback'
  | 'mode_change'
  | 'upstream_change'
  | 'service_reload'
  | 'service_restart'
  | 'cache_flush'
  | 'alert_ack';

interface AuditEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: AuditEventType;
  actor: {
    ip: string;
    user?: string;
    userAgent?: string;
  };
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
  reason?: string;
}

let auditLogPath: string | null = null;

/**
 * Initialize audit logger
 */
export function initAuditLogger(logPath: string): void {
  auditLogPath = logPath;

  // Ensure directory exists
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write audit log entry
 */
function writeAuditLog(entry: AuditEntry): void {
  if (!auditLogPath) {
    console.warn('Audit logger not initialized, logging to console');
    console.log(JSON.stringify(entry));
    return;
  }

  try {
    appendFileSync(auditLogPath, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Log successful login
 */
export function logLoginSuccess(ip: string, user: string, userAgent?: string): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'login_success',
    actor: { ip, user, userAgent },
    result: 'success',
  });
}

/**
 * Log failed login
 */
export function logLoginFailure(ip: string, userAgent?: string, reason?: string): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'warn',
    event: 'login_failure',
    actor: { ip, userAgent },
    result: 'failure',
    reason,
  });
}

/**
 * Log password change
 */
export function logPasswordChange(ip: string, user: string, success: boolean): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: success ? 'info' : 'warn',
    event: 'password_change',
    actor: { ip, user },
    result: success ? 'success' : 'failure',
  });
}

/**
 * Log config apply
 */
export function logConfigApply(
  ip: string,
  user: string,
  details: Record<string, unknown>,
  success: boolean,
  reason?: string
): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: success ? 'info' : 'error',
    event: 'config_apply',
    actor: { ip, user },
    details,
    result: success ? 'success' : 'failure',
    reason,
  });
}

/**
 * Log config rollback
 */
export function logConfigRollback(
  ip: string,
  user: string,
  reason: string
): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'warn',
    event: 'config_rollback',
    actor: { ip, user },
    result: 'success',
    reason,
  });
}

/**
 * Log mode change
 */
export function logModeChange(
  ip: string,
  user: string,
  oldMode: string,
  newMode: string
): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'mode_change',
    actor: { ip, user },
    details: { oldMode, newMode },
    result: 'success',
  });
}

/**
 * Log upstream change
 */
export function logUpstreamChange(
  ip: string,
  user: string,
  details: Record<string, unknown>
): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'upstream_change',
    actor: { ip, user },
    details,
    result: 'success',
  });
}

/**
 * Log service reload
 */
export function logServiceReload(ip: string, user: string, success: boolean): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: success ? 'info' : 'error',
    event: 'service_reload',
    actor: { ip, user },
    result: success ? 'success' : 'failure',
  });
}

/**
 * Log service restart
 */
export function logServiceRestart(ip: string, user: string, success: boolean): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: success ? 'info' : 'error',
    event: 'service_restart',
    actor: { ip, user },
    result: success ? 'success' : 'failure',
  });
}

/**
 * Log cache flush
 */
export function logCacheFlush(ip: string, user: string, zone?: string): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'cache_flush',
    actor: { ip, user },
    details: { zone: zone || 'all' },
    result: 'success',
  });
}

/**
 * Log alert acknowledgment
 */
export function logAlertAck(ip: string, user: string, alertId: string): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'alert_ack',
    actor: { ip, user },
    details: { alertId },
    result: 'success',
  });
}
