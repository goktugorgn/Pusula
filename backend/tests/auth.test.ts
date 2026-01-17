/**
 * Auth unit tests
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/auth.js';

describe('Auth', () => {
  describe('hashPassword', () => {
    it('should generate a bcrypt hash', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$')).toBe(true);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'test-password-123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword(password, hash);
      
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword('wrong-password', hash);
      
      expect(result).toBe(false);
    });

    it('should reject empty password', async () => {
      const hash = await hashPassword('test-password');
      
      const result = await verifyPassword('', hash);
      
      expect(result).toBe(false);
    });
  });
});
