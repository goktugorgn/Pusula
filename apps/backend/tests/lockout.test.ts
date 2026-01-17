/**
 * Lockout unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initLockoutManager,
  shutdownLockoutManager,
  checkLockout,
  recordLoginFailure,
  recordLoginSuccess,
  isLockedOut,
} from '../src/security/lockout.js';
import { LockoutError } from '../src/utils/errors.js';

describe('lockout', () => {
  beforeEach(() => {
    initLockoutManager({
      threshold: 3,
      durationMs: 1000,
      extendedThreshold: 5,
      extendedDurationMs: 2000,
    });
  });

  afterEach(() => {
    shutdownLockoutManager();
  });

  it('does not lock out on first failure', () => {
    const ip = '192.168.1.100';
    recordLoginFailure(ip);
    expect(isLockedOut(ip)).toBe(false);
  });

  it('locks out after threshold failures', () => {
    const ip = '192.168.1.101';

    for (let i = 0; i < 3; i++) {
      recordLoginFailure(ip);
    }

    expect(isLockedOut(ip)).toBe(true);
    expect(() => checkLockout(ip)).toThrow(LockoutError);
  });

  it('clears lockout on successful login', () => {
    const ip = '192.168.1.102';

    for (let i = 0; i < 3; i++) {
      recordLoginFailure(ip);
    }

    expect(isLockedOut(ip)).toBe(true);

    recordLoginSuccess(ip);

    expect(isLockedOut(ip)).toBe(false);
  });
});
