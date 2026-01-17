/**
 * SafeExec unit tests
 */

import { describe, it, expect } from 'vitest';
import { isAllowedCommand, getAllowedCommands } from '../src/utils/safeExec.js';

describe('safeExec', () => {
  describe('isAllowedCommand', () => {
    it('returns true for allowed commands', () => {
      expect(isAllowedCommand('unbound-status')).toBe(true);
      expect(isAllowedCommand('unbound-reload')).toBe(true);
      expect(isAllowedCommand('systemctl-restart')).toBe(true);
    });

    it('returns false for unknown commands', () => {
      expect(isAllowedCommand('rm')).toBe(false);
      expect(isAllowedCommand('cat')).toBe(false);
      expect(isAllowedCommand('arbitrary-command')).toBe(false);
    });
  });

  describe('getAllowedCommands', () => {
    it('returns array of command IDs', () => {
      const commands = getAllowedCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('unbound-status');
      expect(commands).toContain('unbound-reload');
    });
  });
});
