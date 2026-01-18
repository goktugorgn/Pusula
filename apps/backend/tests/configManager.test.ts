/**
 * Config manager unit tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateManagedConfig } from '../src/services/configManager.js';
import {
  upstreamConfigSchema,
  dotProviderSchema,
  dohProviderSchema,
  updateUpstreamRequestSchema,
  type UpstreamConfig,
} from '../src/config/schema.js';

describe('configManager', () => {
  describe('generateManagedConfig', () => {
    it('generates recursive mode config (no forward-zone)', () => {
      const config: UpstreamConfig = {
        mode: 'recursive',
        dotProviders: [],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# Mode: recursive');
      expect(output).toContain('# Recursive mode - direct root resolution');
      // Should not have forward-zone: directive
      expect(output).not.toContain('forward-zone:');
    });

    it('generates DoT mode config with providers', () => {
      const config: UpstreamConfig = {
        mode: 'dot',
        dotProviders: [
          { id: 'cf', name: 'Cloudflare', address: '1.1.1.1', port: 853, sni: 'cloudflare-dns.com', enabled: true },
          { id: 'google', name: 'Google', address: '8.8.8.8', port: 853, sni: 'dns.google', enabled: true },
          { id: 'disabled', name: 'Disabled', address: '9.9.9.9', port: 853, enabled: false },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# Mode: dot');
      expect(output).toContain('forward-zone:');
      expect(output).toContain('name: "."');
      expect(output).toContain('forward-tls-upstream: yes');
      expect(output).toContain('forward-addr: 1.1.1.1@853#cloudflare-dns.com');
      expect(output).toContain('forward-addr: 8.8.8.8@853#dns.google');
      // Disabled provider should not appear
      expect(output).not.toContain('9.9.9.9');
    });

    it('generates DoT mode with no enabled providers', () => {
      const config: UpstreamConfig = {
        mode: 'dot',
        dotProviders: [
          { id: 'disabled', name: 'Disabled', address: '9.9.9.9', port: 853, enabled: false },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# DoT mode but no enabled providers');
      expect(output).not.toContain('forward-zone:');
    });

    it('generates DoH mode config with local proxy', () => {
      const config: UpstreamConfig = {
        mode: 'doh',
        dotProviders: [],
        dohProviders: [
          { id: 'cf', name: 'Cloudflare', endpointUrl: 'https://cloudflare-dns.com/dns-query', enabled: true },
        ],
        activeOrder: [],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# Mode: doh');
      expect(output).toContain('# DoH mode - forwarding to local proxy');
      expect(output).toContain('# Proxy type: cloudflared');
      expect(output).toContain('forward-zone:');
      expect(output).toContain('forward-addr: 127.0.0.1@5053');
    });

    it('uses custom DoH proxy port', () => {
      const config: UpstreamConfig = {
        mode: 'doh',
        dotProviders: [],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'dnscrypt-proxy', localPort: 5300 },
      };

      const output = generateManagedConfig(config);

      expect(output).toContain('# Proxy type: dnscrypt-proxy');
      expect(output).toContain('forward-addr: 127.0.0.1@5300');
    });

    it('sorts providers by priority', () => {
      const config: UpstreamConfig = {
        mode: 'dot',
        dotProviders: [
          { id: 'low', name: 'Low Priority', address: '9.9.9.9', port: 853, enabled: true, priority: 100 },
          { id: 'high', name: 'High Priority', address: '1.1.1.1', port: 853, enabled: true, priority: 1 },
        ],
        dohProviders: [],
        activeOrder: [],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
      };

      const output = generateManagedConfig(config);
      const lines = output.split('\n');

      // Find forward-addr lines
      const addrLines = lines.filter((l) => l.includes('forward-addr'));

      // High priority (1.1.1.1) should come before low priority (9.9.9.9)
      expect(addrLines[0]).toContain('1.1.1.1');
      expect(addrLines[1]).toContain('9.9.9.9');
    });
  });
});

describe('upstream schema validation', () => {
  describe('dotProviderSchema', () => {
    it('validates valid DoT provider', () => {
      const result = dotProviderSchema.parse({
        id: 'cloudflare',
        name: 'Cloudflare',
        address: '1.1.1.1',
        port: 853,
        sni: 'cloudflare-dns.com',
        enabled: true,
      });

      expect(result.id).toBe('cloudflare');
      expect(result.port).toBe(853);
    });

    it('uses default port 853', () => {
      const result = dotProviderSchema.parse({
        id: 'test',
        address: '1.1.1.1',
      });

      expect(result.port).toBe(853);
      expect(result.enabled).toBe(true);
    });

    it('rejects empty id', () => {
      expect(() =>
        dotProviderSchema.parse({
          id: '',
          address: '1.1.1.1',
        })
      ).toThrow(z.ZodError);
    });

    it('rejects invalid port', () => {
      expect(() =>
        dotProviderSchema.parse({
          id: 'test',
          address: '1.1.1.1',
          port: 99999,
        })
      ).toThrow(z.ZodError);
    });
  });

  describe('dohProviderSchema', () => {
    it('validates valid DoH provider', () => {
      const result = dohProviderSchema.parse({
        id: 'cloudflare',
        name: 'Cloudflare',
        endpointUrl: 'https://cloudflare-dns.com/dns-query',
        enabled: true,
      });

      expect(result.id).toBe('cloudflare');
      expect(result.endpointUrl).toBe('https://cloudflare-dns.com/dns-query');
    });

    it('rejects invalid URL', () => {
      expect(() =>
        dohProviderSchema.parse({
          id: 'test',
          endpointUrl: 'not-a-url',
        })
      ).toThrow(z.ZodError);
    });
  });

  describe('upstreamConfigSchema', () => {
    it('uses default values', () => {
      const result = upstreamConfigSchema.parse({});

      expect(result.mode).toBe('recursive');
      expect(result.dotProviders).toEqual([]);
      expect(result.dohProviders).toEqual([]);
      expect(result.activeOrder).toEqual([]);
      expect(result.dohProxy.type).toBe('cloudflared');
      expect(result.dohProxy.localPort).toBe(5053);
    });
  });

  describe('updateUpstreamRequestSchema', () => {
    it('validates complete update request', () => {
      const result = updateUpstreamRequestSchema.parse({
        mode: 'dot',
        dotProviders: [
          { id: 'cf', address: '1.1.1.1' },
        ],
        dohProxy: { type: 'cloudflared', localPort: 5053 },
        runSelfTest: true,
      });

      expect(result.mode).toBe('dot');
      expect(result.dotProviders?.length).toBe(1);
    });

    it('allows partial update', () => {
      const result = updateUpstreamRequestSchema.parse({
        mode: 'recursive',
      });

      expect(result.mode).toBe('recursive');
      expect(result.dotProviders).toBeUndefined();
    });
  });
});
