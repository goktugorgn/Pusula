/**
 * Audit logger for security events
 *
 * Logs all state-changing actions to JSON-lines format:
 * - Login success/failure
 * - Password changes
 * - Config apply/rollback
 * - Service operations
 * - Alert acknowledgments
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type AuditEvent =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'config_apply'
  | 'config_rollback'
  | 'mode_change'
  | 'upstream_change'
  | 'service_reload'
  | 'service_restart'
  | 'cache_flush'
  | 'alert_ack'
  | 'self_test';

export type AuditResult = 'success' | 'failure' | 'warning';

export interface AuditEntry {
  timestamp: string;
  event: AuditEvent;
  actor: {
    ip: string;
    user?: string;
    userAgent?: string;
  };
  details?: Record<string, unknown>;
  result: AuditResult;
  error?: string;
}

// Default log path
let logPath =
  process.env.AUDIT_LOG_PATH || '/var/log/unbound-ui/audit.log';

/**
 * Configure audit logger
 */
export function configureAuditLogger(path: string): void {
  logPath = path;
}

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Log an audit event
 */
export function logAuditEvent(entry: Omit<AuditEntry, 'timestamp'>): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  try {
    ensureLogDir();
    appendFileSync(logPath, JSON.stringify(fullEntry) + '\n');
  } catch (err) {
    // Log to stderr if file write fails
    console.error('Audit log write failed:', err);
    console.error('Entry:', JSON.stringify(fullEntry));
  }
}

/**
 * Log a login attempt
 */
export function logLogin(
  ip: string,
  username: string,
  success: boolean,
  userAgent?: string,
  error?: string
): void {
  logAuditEvent({
    event: success ? 'login_success' : 'login_failure',
    actor: { ip, user: username, userAgent },
    result: success ? 'success' : 'failure',
    error,
  });
}

/**
 * Log a password change
 */
export function logPasswordChange(
  ip: string,
  username: string,
  success: boolean,
  error?: string
): void {
  logAuditEvent({
    event: 'password_change',
    actor: { ip, user: username },
    result: success ? 'success' : 'failure',
    error,
  });
}

/**
 * Log a configuration change
 */
export function logConfigChange(
  ip: string,
  username: string,
  action: 'apply' | 'rollback',
  details: Record<string, unknown>,
  success: boolean,
  error?: string
): void {
  logAuditEvent({
    event: action === 'apply' ? 'config_apply' : 'config_rollback',
    actor: { ip, user: username },
    details,
    result: success ? 'success' : 'failure',
    error,
  });
}

/**
 * Log a mode change
 */
export function logModeChange(
  ip: string,
  username: string,
  fromMode: string,
  toMode: string,
  success: boolean
): void {
  logAuditEvent({
    event: 'mode_change',
    actor: { ip, user: username },
    details: { fromMode, toMode },
    result: success ? 'success' : 'failure',
  });
}

/**
 * Log a service operation
 */
export function logServiceOp(
  ip: string,
  username: string,
  operation: 'reload' | 'restart',
  service: string,
  success: boolean,
  error?: string
): void {
  logAuditEvent({
    event: operation === 'reload' ? 'service_reload' : 'service_restart',
    actor: { ip, user: username },
    details: { service },
    result: success ? 'success' : 'failure',
    error,
  });
}

/**
 * Log cache flush
 */
export function logCacheFlush(
  ip: string,
  username: string,
  type: 'all' | 'zone',
  zone?: string,
  success: boolean = true
): void {
  logAuditEvent({
    event: 'cache_flush',
    actor: { ip, user: username },
    details: { type, zone },
    result: success ? 'success' : 'failure',
  });
}

/**
 * Log alert acknowledgment
 */
export function logAlertAck(
  ip: string,
  username: string,
  alertId: string
): void {
  logAuditEvent({
    event: 'alert_ack',
    actor: { ip, user: username },
    details: { alertId },
    result: 'success',
  });
}

/**
 * Log self-test execution
 */
export function logSelfTest(
  ip: string,
  username: string,
  passed: boolean,
  details: Record<string, unknown>
): void {
  logAuditEvent({
    event: 'self_test',
    actor: { ip, user: username },
    details,
    result: passed ? 'success' : 'warning',
  });
}

export default {
  configureAuditLogger,
  logAuditEvent,
  logLogin,
  logPasswordChange,
  logConfigChange,
  logModeChange,
  logServiceOp,
  logCacheFlush,
  logAlertAck,
  logSelfTest,
};
