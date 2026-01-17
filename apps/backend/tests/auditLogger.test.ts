/**
 * Audit logger unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appendFileSync, mkdirSync, existsSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

import {
  logLogin,
  logPasswordChange,
  configureAuditLogger,
} from '../src/security/auditLogger.js';

describe('auditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureAuditLogger('/tmp/test-audit.log');
  });

  describe('logLogin', () => {
    it('logs successful login', () => {
      logLogin('192.168.1.100', 'goktugorgn', true, 'Mozilla/5.0');

      expect(appendFileSync).toHaveBeenCalledTimes(1);
      const call = (appendFileSync as any).mock.calls[0];
      const entry = JSON.parse(call[1].trim());

      expect(entry.event).toBe('login_success');
      expect(entry.actor.ip).toBe('192.168.1.100');
      expect(entry.actor.user).toBe('goktugorgn');
      expect(entry.result).toBe('success');
      expect(entry.timestamp).toBeDefined();
    });

    it('logs failed login with error', () => {
      logLogin('192.168.1.100', 'goktugorgn', false, 'Mozilla/5.0', 'Invalid credentials');

      expect(appendFileSync).toHaveBeenCalledTimes(1);
      const call = (appendFileSync as any).mock.calls[0];
      const entry = JSON.parse(call[1].trim());

      expect(entry.event).toBe('login_failure');
      expect(entry.result).toBe('failure');
      expect(entry.error).toBe('Invalid credentials');
    });
  });

  describe('logPasswordChange', () => {
    it('logs successful password change', () => {
      logPasswordChange('192.168.1.100', 'goktugorgn', true);

      expect(appendFileSync).toHaveBeenCalledTimes(1);
      const call = (appendFileSync as any).mock.calls[0];
      const entry = JSON.parse(call[1].trim());

      expect(entry.event).toBe('password_change');
      expect(entry.result).toBe('success');
    });

    it('logs failed password change', () => {
      logPasswordChange('192.168.1.100', 'goktugorgn', false, 'Invalid current password');

      expect(appendFileSync).toHaveBeenCalledTimes(1);
      const call = (appendFileSync as any).mock.calls[0];
      const entry = JSON.parse(call[1].trim());

      expect(entry.event).toBe('password_change');
      expect(entry.result).toBe('failure');
      expect(entry.error).toBe('Invalid current password');
    });
  });
});
