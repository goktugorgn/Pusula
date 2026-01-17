/**
 * SafeExec unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  isAllowedCommand,
  getAllowedCommands,
  validateParam,
  isValidZone,
  isValidHostname,
  isValidDohUrl,
  ALLOWED_SERVICES,
  ALLOWED_UNITS,
} from '../src/utils/safeExec.js';
import { ValidationError } from '../src/utils/errors.js';

describe('safeExec', () => {
  // ==========================================================================
  // Command allowlist
  // ==========================================================================
  describe('isAllowedCommand', () => {
    it('returns true for allowed unbound-control commands', () => {
      expect(isAllowedCommand('unbound-status')).toBe(true);
      expect(isAllowedCommand('unbound-stats')).toBe(true);
      expect(isAllowedCommand('unbound-reload')).toBe(true);
      expect(isAllowedCommand('unbound-flush-all')).toBe(true);
      expect(isAllowedCommand('unbound-flush-zone')).toBe(true);
      expect(isAllowedCommand('unbound-flush-request')).toBe(true);
    });

    it('returns true for allowed systemctl commands', () => {
      expect(isAllowedCommand('systemctl-is-active')).toBe(true);
      expect(isAllowedCommand('systemctl-status')).toBe(true);
      expect(isAllowedCommand('systemctl-reload')).toBe(true);
      expect(isAllowedCommand('systemctl-restart')).toBe(true);
    });

    it('returns true for allowed journalctl commands', () => {
      expect(isAllowedCommand('journalctl-read')).toBe(true);
      expect(isAllowedCommand('journalctl-since')).toBe(true);
    });

    it('returns false for non-allowlisted commands', () => {
      expect(isAllowedCommand('rm')).toBe(false);
      expect(isAllowedCommand('cat')).toBe(false);
      expect(isAllowedCommand('bash')).toBe(false);
      expect(isAllowedCommand('curl')).toBe(false);
      expect(isAllowedCommand('wget')).toBe(false);
      expect(isAllowedCommand('arbitrary-command')).toBe(false);
      expect(isAllowedCommand('')).toBe(false);
      expect(isAllowedCommand('unbound-control')).toBe(false); // Direct command name not allowed
    });
  });

  describe('getAllowedCommands', () => {
    it('returns array of command IDs', () => {
      const commands = getAllowedCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(10);
    });

    it('contains all expected commands', () => {
      const commands = getAllowedCommands();

      // unbound-control
      expect(commands).toContain('unbound-status');
      expect(commands).toContain('unbound-stats');
      expect(commands).toContain('unbound-reload');
      expect(commands).toContain('unbound-flush-zone');
      expect(commands).toContain('unbound-flush-request');

      // systemctl
      expect(commands).toContain('systemctl-is-active');
      expect(commands).toContain('systemctl-restart');

      // journalctl
      expect(commands).toContain('journalctl-read');
    });
  });

  // ==========================================================================
  // Parameter validation - ZONE
  // ==========================================================================
  describe('validateParam ZONE', () => {
    it('accepts valid zones', () => {
      expect(() => validateParam('ZONE', 'example.com')).not.toThrow();
      expect(() => validateParam('ZONE', 'sub.example.com')).not.toThrow();
      expect(() => validateParam('ZONE', 'example.com.')).not.toThrow();
      expect(() => validateParam('ZONE', '.')).not.toThrow();
      expect(() => validateParam('ZONE', 'a.b.c.d.e')).not.toThrow();
      expect(() => validateParam('ZONE', 'my-domain.co.uk')).not.toThrow();
    });

    it('rejects invalid zones', () => {
      expect(() => validateParam('ZONE', '-invalid.com')).toThrow(ValidationError);
      expect(() => validateParam('ZONE', 'invalid-.com')).toThrow(ValidationError);
      expect(() => validateParam('ZONE', 'spaces here.com')).toThrow(ValidationError);
      expect(() => validateParam('ZONE', '../etc/passwd')).toThrow(ValidationError);
      expect(() => validateParam('ZONE', '; rm -rf /')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - HOSTNAME
  // ==========================================================================
  describe('validateParam HOSTNAME', () => {
    it('accepts valid hostnames', () => {
      expect(() => validateParam('HOSTNAME', 'ns1.example.com')).not.toThrow();
      expect(() => validateParam('HOSTNAME', 'localhost')).not.toThrow();
      expect(() => validateParam('HOSTNAME', 'my-server')).not.toThrow();
      expect(() => validateParam('HOSTNAME', 'a.b.c')).not.toThrow();
    });

    it('rejects invalid hostnames', () => {
      expect(() => validateParam('HOSTNAME', '')).toThrow(ValidationError);
      expect(() => validateParam('HOSTNAME', '-invalid')).toThrow(ValidationError);
      expect(() => validateParam('HOSTNAME', 'invalid-')).toThrow(ValidationError);
      expect(() => validateParam('HOSTNAME', 'spaces here')).toThrow(ValidationError);
      expect(() => validateParam('HOSTNAME', '../passwd')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - SERVICE
  // ==========================================================================
  describe('validateParam SERVICE', () => {
    it('accepts allowed services', () => {
      for (const service of ALLOWED_SERVICES) {
        expect(() => validateParam('SERVICE', service)).not.toThrow();
      }
    });

    it('rejects non-allowed services', () => {
      expect(() => validateParam('SERVICE', 'nginx')).toThrow(ValidationError);
      expect(() => validateParam('SERVICE', 'apache2')).toThrow(ValidationError);
      expect(() => validateParam('SERVICE', 'sshd')).toThrow(ValidationError);
      expect(() => validateParam('SERVICE', 'systemd')).toThrow(ValidationError);
      expect(() => validateParam('SERVICE', '../unbound')).toThrow(ValidationError);
      expect(() => validateParam('SERVICE', 'unbound; rm -rf /')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - UNIT
  // ==========================================================================
  describe('validateParam UNIT', () => {
    it('accepts allowed units', () => {
      for (const unit of ALLOWED_UNITS) {
        expect(() => validateParam('UNIT', unit)).not.toThrow();
      }
    });

    it('rejects non-allowed units', () => {
      expect(() => validateParam('UNIT', 'ssh')).toThrow(ValidationError);
      expect(() => validateParam('UNIT', 'systemd')).toThrow(ValidationError);
      expect(() => validateParam('UNIT', 'kernel')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - LINES
  // ==========================================================================
  describe('validateParam LINES', () => {
    it('accepts valid line counts', () => {
      expect(() => validateParam('LINES', '1')).not.toThrow();
      expect(() => validateParam('LINES', '100')).not.toThrow();
      expect(() => validateParam('LINES', '9999')).not.toThrow();
    });

    it('rejects invalid line counts', () => {
      expect(() => validateParam('LINES', '0')).not.toThrow(); // 0 is technically valid
      expect(() => validateParam('LINES', '-1')).toThrow(ValidationError);
      expect(() => validateParam('LINES', '10000')).toThrow(ValidationError);
      expect(() => validateParam('LINES', 'abc')).toThrow(ValidationError);
      expect(() => validateParam('LINES', '100; rm')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - SINCE
  // ==========================================================================
  describe('validateParam SINCE', () => {
    it('accepts valid timestamps', () => {
      expect(() => validateParam('SINCE', '2026-01-17')).not.toThrow();
      expect(() => validateParam('SINCE', '2026-01-17T18:00:00')).not.toThrow();
      expect(() => validateParam('SINCE', '2026-01-17T18:00:00Z')).not.toThrow();
      expect(() => validateParam('SINCE', '2026-01-17T18:00:00+03:00')).not.toThrow();
    });

    it('rejects invalid timestamps', () => {
      expect(() => validateParam('SINCE', 'yesterday')).toThrow(ValidationError);
      expect(() => validateParam('SINCE', '01/17/2026')).toThrow(ValidationError);
      expect(() => validateParam('SINCE', '2026-1-17')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Parameter validation - FILE
  // ==========================================================================
  describe('validateParam FILE', () => {
    it('accepts valid unbound config paths', () => {
      expect(() => validateParam('FILE', '/etc/unbound/unbound.conf')).not.toThrow();
      expect(() => validateParam('FILE', '/etc/unbound/local.conf')).not.toThrow();
      expect(() => validateParam('FILE', '/etc/unbound/my-config.conf')).not.toThrow();
    });

    it('rejects paths outside /etc/unbound/', () => {
      expect(() => validateParam('FILE', '/etc/passwd')).toThrow(ValidationError);
      expect(() => validateParam('FILE', '/tmp/unbound.conf')).toThrow(ValidationError);
      expect(() => validateParam('FILE', '/etc/unbound/../passwd')).toThrow(ValidationError);
    });

    it('rejects path traversal attacks', () => {
      expect(() => validateParam('FILE', '/etc/unbound/../../passwd')).toThrow(ValidationError);
      expect(() => validateParam('FILE', '/etc/unbound//double-slash.conf')).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Validation helpers
  // ==========================================================================
  describe('isValidZone', () => {
    it('validates zone names', () => {
      expect(isValidZone('example.com')).toBe(true);
      expect(isValidZone('.')).toBe(true);
      expect(isValidZone('')).toBe(true); // Empty is valid (matches root)
      expect(isValidZone('invalid space')).toBe(false);
    });
  });

  describe('isValidHostname', () => {
    it('validates hostnames', () => {
      expect(isValidHostname('example.com')).toBe(true);
      expect(isValidHostname('localhost')).toBe(true);
      expect(isValidHostname('')).toBe(false);
      expect(isValidHostname('-invalid')).toBe(false);
    });
  });

  describe('isValidDohUrl', () => {
    it('accepts known DoH endpoints', () => {
      expect(isValidDohUrl('https://cloudflare-dns.com/dns-query')).toBe(true);
      expect(isValidDohUrl('https://dns.google/dns-query')).toBe(true);
      expect(isValidDohUrl('https://dns.quad9.net/dns-query')).toBe(true);
    });

    it('rejects unknown URLs', () => {
      expect(isValidDohUrl('https://evil.com/dns-query')).toBe(false);
      expect(isValidDohUrl('http://cloudflare-dns.com')).toBe(false); // Must be HTTPS
      expect(isValidDohUrl('https://cloudflare-dns.com/other')).toBe(false);
    });
  });

  // ==========================================================================
  // Unknown parameter
  // ==========================================================================
  describe('validateParam unknown', () => {
    it('rejects unknown parameter names', () => {
      expect(() => validateParam('UNKNOWN', 'value')).toThrow(ValidationError);
      expect(() => validateParam('CMD', 'rm -rf /')).toThrow(ValidationError);
    });
  });
});
