/**
 * Brute-force lockout manager
 * 
 * Tracks failed login attempts per IP and enforces temporary lockouts
 */

import { LockoutError } from '../utils/errors.js';

interface LockoutEntry {
  failures: number;
  lastFailure: number;
  lockedUntil: number | null;
}

interface LockoutConfig {
  threshold: number;       // Failures before lockout
  durationMs: number;      // Standard lockout duration
  extendedThreshold: number; // Failures before extended lockout
  extendedDurationMs: number; // Extended lockout duration
}

class LockoutManager {
  private entries: Map<string, LockoutEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private config: LockoutConfig) {
    // Cleanup stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Check if an IP is currently locked out
   * @throws LockoutError if locked
   */
  check(ip: string): void {
    const entry = this.entries.get(ip);
    if (!entry) return;

    const now = Date.now();

    if (entry.lockedUntil && now < entry.lockedUntil) {
      const remainingMs = entry.lockedUntil - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new LockoutError(remainingMinutes);
    }

    // Lockout expired, reset it
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      entry.lockedUntil = null;
    }
  }

  /**
   * Record a failed login attempt
   */
  recordFailure(ip: string): void {
    const now = Date.now();
    let entry = this.entries.get(ip);

    if (!entry) {
      entry = { failures: 0, lastFailure: now, lockedUntil: null };
      this.entries.set(ip, entry);
    }

    // Reset failure count if last failure was over an hour ago
    if (now - entry.lastFailure > 3600000) {
      entry.failures = 0;
    }

    entry.failures++;
    entry.lastFailure = now;

    // Check for extended lockout
    if (entry.failures >= this.config.extendedThreshold) {
      entry.lockedUntil = now + this.config.extendedDurationMs;
    }
    // Check for standard lockout
    else if (entry.failures >= this.config.threshold) {
      entry.lockedUntil = now + this.config.durationMs;
    }
  }

  /**
   * Clear lockout on successful login
   */
  recordSuccess(ip: string): void {
    this.entries.delete(ip);
  }

  /**
   * Get current failure count for an IP
   */
  getFailureCount(ip: string): number {
    const entry = this.entries.get(ip);
    return entry?.failures || 0;
  }

  /**
   * Check if IP is locked (without throwing)
   */
  isLocked(ip: string): boolean {
    const entry = this.entries.get(ip);
    if (!entry || !entry.lockedUntil) return false;
    return Date.now() < entry.lockedUntil;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [ip, entry] of this.entries) {
      // Remove entries with no recent activity and no active lockout
      if (entry.lastFailure < oneHourAgo && (!entry.lockedUntil || entry.lockedUntil < now)) {
        this.entries.delete(ip);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
let lockoutManager: LockoutManager | null = null;

/**
 * Initialize lockout manager
 */
export function initLockoutManager(config: LockoutConfig): void {
  lockoutManager = new LockoutManager(config);
}

/**
 * Check lockout status (throws if locked)
 */
export function checkLockout(ip: string): void {
  if (!lockoutManager) {
    throw new Error('Lockout manager not initialized');
  }
  lockoutManager.check(ip);
}

/**
 * Record failed login
 */
export function recordLoginFailure(ip: string): void {
  if (!lockoutManager) {
    throw new Error('Lockout manager not initialized');
  }
  lockoutManager.recordFailure(ip);
}

/**
 * Record successful login
 */
export function recordLoginSuccess(ip: string): void {
  if (!lockoutManager) {
    throw new Error('Lockout manager not initialized');
  }
  lockoutManager.recordSuccess(ip);
}

/**
 * Check if IP is locked (without throwing)
 */
export function isLockedOut(ip: string): boolean {
  if (!lockoutManager) return false;
  return lockoutManager.isLocked(ip);
}

/**
 * Shutdown lockout manager
 */
export function shutdownLockoutManager(): void {
  lockoutManager?.stop();
}
