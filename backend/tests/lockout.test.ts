/**
 * Lockout unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initLockoutManager,
  checkLockout,
  recordLoginFailure,
  recordLoginSuccess,
  isLockedOut,
  shutdownLockoutManager,
} from '../src/security/lockout.js';
import { LockoutError } from '../src/utils/errors.js';

describe('Lockout Manager', () => {
  beforeEach(() => {
    // Initialize with test config
    initLockoutManager({
      threshold: 3,
      durationMs: 1000, // 1 second for testing
      extendedThreshold: 5,
      extendedDurationMs: 2000,
    });
  });

  afterEach(() => {
    shutdownLockoutManager();
  });

  it('should not lock out on first failure', () => {
    const ip = '192.168.1.100';
    
    recordLoginFailure(ip);
    
    expect(isLockedOut(ip)).toBe(false);
    expect(() => checkLockout(ip)).not.toThrow();
  });

  it('should lock out after threshold failures', () => {
    const ip = '192.168.1.101';
    
    // Record failures up to threshold
    for (let i = 0; i < 3; i++) {
      recordLoginFailure(ip);
    }
    
    expect(isLockedOut(ip)).toBe(true);
    expect(() => checkLockout(ip)).toThrow(LockoutError);
  });

  it('should clear lockout on successful login', () => {
    const ip = '192.168.1.102';
    
    // Lock out the IP
    for (let i = 0; i < 3; i++) {
      recordLoginFailure(ip);
    }
    
    expect(isLockedOut(ip)).toBe(true);
    
    // Successful login should clear lockout
    recordLoginSuccess(ip);
    
    expect(isLockedOut(ip)).toBe(false);
    expect(() => checkLockout(ip)).not.toThrow();
  });

  it('should allow access after lockout expires', async () => {
    const ip = '192.168.1.103';
    
    // Lock out the IP
    for (let i = 0; i < 3; i++) {
      recordLoginFailure(ip);
    }
    
    expect(isLockedOut(ip)).toBe(true);
    
    // Wait for lockout to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(() => checkLockout(ip)).not.toThrow();
  });

  it('should throw LockoutError with remaining minutes', () => {
    const ip = '192.168.1.104';
    
    // Lock out the IP with longer duration
    initLockoutManager({
      threshold: 1,
      durationMs: 60000, // 1 minute
      extendedThreshold: 5,
      extendedDurationMs: 120000,
    });
    
    recordLoginFailure(ip);
    
    try {
      checkLockout(ip);
      expect.fail('Should have thrown LockoutError');
    } catch (error) {
      expect(error).toBeInstanceOf(LockoutError);
      expect(error.message).toContain('minute');
    }
  });
});
