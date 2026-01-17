/**
 * Auth unit tests
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/auth.js';

describe('auth', () => {
  describe('hashPassword', () => {
    it('generates an Argon2id hash', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);
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
  });
});
