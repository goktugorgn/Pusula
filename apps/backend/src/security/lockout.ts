/**
 * Brute-force protection with IP-based lockout
 *
 * Per SSOT:
 * - 5 failures → 15 minute lockout
 * - 10 failures → 1 hour lockout
 *
 * Lockout is per-IP to prevent attacker from locking victim's account.
 */

import { LockoutError } from '../utils/errors.js';

interface LockoutRecord {
  failureCount: number;
  lockedUntil: number | null;
  firstFailure: number;
}

interface LockoutConfig {
  threshold: number;
  durationMs: number;
  extendedThreshold: number;
  extendedDurationMs: number;
}

// In-memory store (per-instance)
const lockoutStore = new Map<string, LockoutRecord>();

// Configuration
let config: LockoutConfig = {
  threshold: 5,
  durationMs: 15 * 60 * 1000,  // 15 minutes
  extendedThreshold: 10,
  extendedDurationMs: 60 * 60 * 1000,  // 1 hour
};

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize lockout manager with config
 */
export function initLockoutManager(cfg: Partial<LockoutConfig>): void {
  config = { ...config, ...cfg };

  // Setup periodic cleanup
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanup, 60000); // Every minute
}

/**
 * Shutdown lockout manager
 */
export function shutdownLockoutManager(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  lockoutStore.clear();
}

/**
 * Check if an IP is currently locked out
 */
export function isLockedOut(ip: string): boolean {
  const record = lockoutStore.get(ip);
  if (!record || !record.lockedUntil) {
    return false;
  }
  return Date.now() < record.lockedUntil;
}

/**
 * Get remaining lockout time in minutes
 */
export function getRemainingLockoutMinutes(ip: string): number {
  const record = lockoutStore.get(ip);
  if (!record || !record.lockedUntil) {
    return 0;
  }
  const remaining = record.lockedUntil - Date.now();
  return Math.max(0, Math.ceil(remaining / 60000));
}

/**
 * Check lockout and throw if locked
 */
export function checkLockout(ip: string): void {
  if (isLockedOut(ip)) {
    const minutes = getRemainingLockoutMinutes(ip);
    throw new LockoutError(minutes);
  }
}

/**
 * Record a failed login attempt
 */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  let record = lockoutStore.get(ip);

  if (!record) {
    record = {
      failureCount: 0,
      lockedUntil: null,
      firstFailure: now,
    };
  }

  // Reset if first failure was too long ago (sliding window)
  if (now - record.firstFailure > config.extendedDurationMs) {
    record = {
      failureCount: 0,
      lockedUntil: null,
      firstFailure: now,
    };
  }

  record.failureCount++;

  // Apply lockout based on thresholds
  if (record.failureCount >= config.extendedThreshold) {
    record.lockedUntil = now + config.extendedDurationMs;
  } else if (record.failureCount >= config.threshold) {
    record.lockedUntil = now + config.durationMs;
  }

  lockoutStore.set(ip, record);
}

/**
 * Record a successful login (clears failure count)
 */
export function recordLoginSuccess(ip: string): void {
  lockoutStore.delete(ip);
}

/**
 * Get current failure count for IP
 */
export function getFailureCount(ip: string): number {
  const record = lockoutStore.get(ip);
  return record?.failureCount || 0;
}

/**
 * Cleanup expired records
 */
function cleanup(): void {
  const now = Date.now();
  for (const [ip, record] of lockoutStore.entries()) {
    // Remove if lockout has expired and failures are old
    if (
      !record.lockedUntil ||
      (record.lockedUntil < now &&
        now - record.firstFailure > config.extendedDurationMs)
    ) {
      if (!record.lockedUntil || record.lockedUntil < now) {
        lockoutStore.delete(ip);
      }
    }
  }
}

export default {
  initLockoutManager,
  shutdownLockoutManager,
  isLockedOut,
  checkLockout,
  recordLoginFailure,
  recordLoginSuccess,
  getFailureCount,
};
