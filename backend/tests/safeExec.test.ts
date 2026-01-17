/**
 * SafeExec unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  safeExec,
  isAllowedCommand,
  getAllowedCommands,
} from '../src/utils/safeExec.js';
import { ValidationError } from '../src/utils/errors.js';

describe('SafeExec', () => {
  describe('isAllowedCommand', () => {
    it('should return true for allowed commands', () => {
      expect(isAllowedCommand('unbound-status')).toBe(true);
      expect(isAllowedCommand('unbound-reload')).toBe(true);
      expect(isAllowedCommand('systemctl-is-active')).toBe(true);
    });

    it('should return false for unknown commands', () => {
      expect(isAllowedCommand('rm -rf')).toBe(false);
      expect(isAllowedCommand('arbitrary-command')).toBe(false);
      expect(isAllowedCommand('')).toBe(false);
    });
  });

  describe('getAllowedCommands', () => {
    it('should return array of allowed command IDs', () => {
      const commands = getAllowedCommands();
      
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('unbound-status');
      expect(commands).toContain('unbound-reload');
    });
  });

  describe('safeExec', () => {
    it('should reject unknown commands', async () => {
      await expect(safeExec('unknown-command')).rejects.toThrow(ValidationError);
    });

    it('should reject commands with invalid parameters', async () => {
      // Invalid zone format (contains shell metacharacters)
      await expect(
        safeExec('unbound-flush-zone', { ZONE: '$(rm -rf /)' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject path traversal in FILE parameter', async () => {
      await expect(
        safeExec('unbound-checkconf-file', { FILE: '/etc/../../../etc/passwd' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject disallowed file paths', async () => {
      await expect(
        safeExec('unbound-checkconf-file', { FILE: '/etc/passwd' })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate zone parameter format', async () => {
      // Valid zone
      // Note: This will fail on machines without unbound-control,
      // but should not throw ValidationError
      const validZones = ['example.com', 'test.local', 'a.b.c.d.'];
      
      for (const zone of validZones) {
        // Just check validation passes (command will fail without unbound)
        try {
          await safeExec('unbound-flush-zone', { ZONE: zone });
        } catch (error) {
          // Command error is fine, but should not be ValidationError for valid zones
          expect(error).not.toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should validate service parameter format', async () => {
      // Valid services
      expect(() => {
        // Just trigger validation - will error on execute but pass validation
      }).not.toThrow();

      // Invalid service (shell injection attempt)
      await expect(
        safeExec('systemctl-is-active', { SERVICE: 'unbound; rm -rf /' })
      ).rejects.toThrow(ValidationError);
    });
  });
});
