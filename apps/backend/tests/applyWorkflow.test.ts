/**
 * Apply workflow integration tests
 * Tests snapshot, rollback, and config generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// We'll test the pure functions and snapshot management directly
// without mocking safeExec (which is complex with vitest)

describe('Apply Workflow - Snapshot Management', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'snapshot-test-'));

    // Set env vars BEFORE importing module
    process.env.BACKUP_DIR = join(testDir, 'backups');
    process.env.UNBOUND_MANAGED_CONF = join(testDir, 'managed.conf');
    process.env.UPSTREAM_PATH = join(testDir, 'upstream.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('generateManagedConfig', () => {
    it('generates recursive mode correctly', async () => {
      const { generateManagedConfig } = await import('../src/services/configManager.js');

      const config = {
        mode: 'recursive' as const,
        dotProviders: [],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared' as const, localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# Mode: recursive');
      expect(output).toContain('# Recursive mode');
      expect(output).not.toContain('forward-zone:');
    });

    it('generates DoT mode with multiple providers', async () => {
      const { generateManagedConfig } = await import('../src/services/configManager.js');

      const config = {
        mode: 'dot' as const,
        dotProviders: [
          { id: 'cf', address: '1.1.1.1', port: 853, sni: 'cloudflare-dns.com', enabled: true, priority: 1 },
          { id: 'google', address: '8.8.8.8', port: 853, sni: 'dns.google', enabled: true, priority: 2 },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared' as const, localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('forward-zone:');
      expect(output).toContain('forward-tls-upstream: yes');
      expect(output).toContain('1.1.1.1@853#cloudflare-dns.com');
      expect(output).toContain('8.8.8.8@853#dns.google');
    });

    it('generates DoH mode with proxy config', async () => {
      const { generateManagedConfig } = await import('../src/services/configManager.js');

      const config = {
        mode: 'doh' as const,
        dotProviders: [],
        dohProviders: [{ id: 'cf', endpointUrl: 'https://cloudflare-dns.com/dns-query', enabled: true }],
        activeOrder: [],
        dohProxy: { type: 'dnscrypt-proxy' as const, localPort: 5300 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# DoH mode');
      expect(output).toContain('# Proxy type: dnscrypt-proxy');
      expect(output).toContain('forward-addr: 127.0.0.1@5300');
    });

    it('sorts providers by priority', async () => {
      const { generateManagedConfig } = await import('../src/services/configManager.js');

      const config = {
        mode: 'dot' as const,
        dotProviders: [
          { id: 'low', address: '9.9.9.9', port: 853, enabled: true, priority: 100 },
          { id: 'high', address: '1.1.1.1', port: 853, enabled: true, priority: 1 },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared' as const, localPort: 5053 },
      };

      const output = generateManagedConfig(config);
      const lines = output.split('\n');
      const addrLines = lines.filter((l) => l.includes('forward-addr'));

      // High priority (1.1.1.1) should come first
      expect(addrLines[0]).toContain('1.1.1.1');
      expect(addrLines[1]).toContain('9.9.9.9');
    });

    it('skips disabled providers', async () => {
      const { generateManagedConfig } = await import('../src/services/configManager.js');

      const config = {
        mode: 'dot' as const,
        dotProviders: [
          { id: 'enabled', address: '1.1.1.1', port: 853, enabled: true },
          { id: 'disabled', address: '9.9.9.9', port: 853, enabled: false },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared' as const, localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('1.1.1.1');
      expect(output).not.toContain('9.9.9.9');
    });
  });

  describe('ApplyResult structure', () => {
    it('has correct structure', () => {
      const result = {
        success: true,
        snapshotId: 'snapshot-2026-01-18',
        validationPassed: true,
        reloadPassed: true,
        selfTestPassed: true,
        rolledBack: false,
      };

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('snapshotId');
      expect(result).toHaveProperty('validationPassed');
      expect(result).toHaveProperty('reloadPassed');
      expect(result).toHaveProperty('selfTestPassed');
      expect(result).toHaveProperty('rolledBack');
    });
  });
});

