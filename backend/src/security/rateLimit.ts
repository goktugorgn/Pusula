/**
 * IP-based rate limiting
 * 
 * Implements sliding window rate limiting for login and API endpoints
 */

import { RateLimitError } from '../utils/errors.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private config: RateLimitConfig) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be allowed
   * @returns true if allowed, throws RateLimitError if exceeded
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      // New window
      this.entries.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.config.max) {
      throw new RateLimitError();
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return this.config.max;

    const now = Date.now();
    if (now - entry.windowStart > this.config.windowMs) {
      return this.config.max;
    }

    return Math.max(0, this.config.max - entry.count);
  }

  /**
   * Reset counter for a key
   */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.config.windowMs) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Rate limiter instances
let loginLimiter: RateLimiter | null = null;
let apiLimiter: RateLimiter | null = null;

/**
 * Initialize rate limiters with configuration
 */
export function initRateLimiters(config: {
  login: RateLimitConfig;
  api: RateLimitConfig;
}): void {
  loginLimiter = new RateLimiter(config.login);
  apiLimiter = new RateLimiter(config.api);
}

/**
 * Check login rate limit
 */
export function checkLoginRateLimit(ip: string): boolean {
  if (!loginLimiter) {
    throw new Error('Rate limiter not initialized');
  }
  return loginLimiter.check(ip);
}

/**
 * Check API rate limit
 */
export function checkApiRateLimit(ip: string): boolean {
  if (!apiLimiter) {
    throw new Error('Rate limiter not initialized');
  }
  return apiLimiter.check(ip);
}

/**
 * Get remaining login attempts
 */
export function getRemainingLoginAttempts(ip: string): number {
  if (!loginLimiter) return 0;
  return loginLimiter.getRemaining(ip);
}

/**
 * Reset login rate limit (e.g., after successful login)
 */
export function resetLoginRateLimit(ip: string): void {
  if (loginLimiter) {
    loginLimiter.reset(ip);
  }
}

/**
 * Shutdown rate limiters
 */
export function shutdownRateLimiters(): void {
  loginLimiter?.stop();
  apiLimiter?.stop();
}
