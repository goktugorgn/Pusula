/**
 * Auth unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/auth.js';

describe('auth', () => {
  describe('hashPassword', () => {
    it('generates a bcrypt hash', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('generates different hashes for same password', async () => {
      const password = 'test-password-123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('verifies correct password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('correct-password');

      const result = await verifyPassword('wrong-password', hash);

      expect(result).toBe(false);
    });

    it('handles invalid hash gracefully', async () => {
      const result = await verifyPassword('password', 'not-a-valid-hash');

      expect(result).toBe(false);
    });
  });
});
