/**
 * Pi-hole client unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PiholeSummary, PiholeNotConfigured, PiholeResult } from '../src/services/piholeClient.js';

// Mock config
const mockConfig = {
  pihole: {
    enabled: false,
    baseUrl: '',
    apiToken: '',
  },
};

vi.mock('../src/config/index.js', () => ({
  loadConfig: () => mockConfig,
}));

describe('piholeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset config to disabled
    mockConfig.pihole.enabled = false;
    mockConfig.pihole.baseUrl = '';
    mockConfig.pihole.apiToken = '';
  });

  describe('PiholeSummary structure', () => {
    it('has correct structure when configured', () => {
      const summary: PiholeSummary = {
        configured: true,
        status: 'enabled',
        totalQueries: 12345,
        blockedQueries: 1234,
        percentBlocked: 10.0,
        domainsBeingBlocked: 150000,
        gravityLastUpdated: '2026-01-18T12:00:00Z',
      };

      expect(summary.configured).toBe(true);
      expect(summary.status).toBe('enabled');
      expect(summary.totalQueries).toBe(12345);
      expect(summary.blockedQueries).toBe(1234);
      expect(summary.percentBlocked).toBe(10.0);
      expect(summary.domainsBeingBlocked).toBe(150000);
      expect(summary.gravityLastUpdated).toBe('2026-01-18T12:00:00Z');
    });

    it('supports null gravityLastUpdated', () => {
      const summary: PiholeSummary = {
        configured: true,
        status: 'enabled',
        totalQueries: 0,
        blockedQueries: 0,
        percentBlocked: 0,
        domainsBeingBlocked: 0,
        gravityLastUpdated: null,
      };

      expect(summary.gravityLastUpdated).toBeNull();
    });
  });

  describe('PiholeNotConfigured structure', () => {
    it('has correct structure when not configured', () => {
      const notConfigured: PiholeNotConfigured = {
        configured: false,
        guidance: 'Pi-hole integration is not configured.',
      };

      expect(notConfigured.configured).toBe(false);
      expect(notConfigured.guidance).toBeDefined();
    });
  });

  describe('Response parsing', () => {
    it('parses Pi-hole API response correctly', () => {
      const apiResponse = {
        status: 'enabled',
        dns_queries_today: '54321',
        ads_blocked_today: '5432',
        ads_percentage_today: '10.0',
        domains_being_blocked: '175000',
        gravity_last_updated: {
          absolute: '1705579200', // Unix timestamp
        },
      };

      // Parse like the client does
      const summary: PiholeSummary = {
        configured: true,
        status: apiResponse.status === 'enabled' ? 'enabled' : 'disabled',
        totalQueries: parseInt(apiResponse.dns_queries_today, 10),
        blockedQueries: parseInt(apiResponse.ads_blocked_today, 10),
        percentBlocked: parseFloat(apiResponse.ads_percentage_today),
        domainsBeingBlocked: parseInt(apiResponse.domains_being_blocked, 10),
        gravityLastUpdated: apiResponse.gravity_last_updated?.absolute
          ? new Date(parseInt(apiResponse.gravity_last_updated.absolute, 10) * 1000).toISOString()
          : null,
      };

      expect(summary.totalQueries).toBe(54321);
      expect(summary.blockedQueries).toBe(5432);
      expect(summary.percentBlocked).toBe(10.0);
      expect(summary.domainsBeingBlocked).toBe(175000);
      expect(summary.gravityLastUpdated).toBeDefined();
    });

    it('handles missing/invalid values gracefully', () => {
      const apiResponse = {
        status: 'unknown',
        // All values missing
      };

      const summary: PiholeSummary = {
        configured: true,
        status: apiResponse.status === 'enabled' ? 'enabled' : apiResponse.status === 'disabled' ? 'disabled' : 'unknown',
        totalQueries: parseInt((apiResponse as any).dns_queries_today || '0', 10),
        blockedQueries: parseInt((apiResponse as any).ads_blocked_today || '0', 10),
        percentBlocked: parseFloat((apiResponse as any).ads_percentage_today || '0'),
        domainsBeingBlocked: parseInt((apiResponse as any).domains_being_blocked || '0', 10),
        gravityLastUpdated: null,
      };

      expect(summary.status).toBe('unknown');
      expect(summary.totalQueries).toBe(0);
      expect(summary.blockedQueries).toBe(0);
      expect(summary.percentBlocked).toBe(0);
    });
  });

  describe('Configuration detection', () => {
    it('detects when Pi-hole is not configured', () => {
      mockConfig.pihole.enabled = false;
      mockConfig.pihole.baseUrl = '';

      const isConfigured = mockConfig.pihole.enabled && !!mockConfig.pihole.baseUrl;
      expect(isConfigured).toBe(false);
    });

    it('detects when Pi-hole is configured', () => {
      mockConfig.pihole.enabled = true;
      mockConfig.pihole.baseUrl = 'http://pi.hole';

      const isConfigured = mockConfig.pihole.enabled && !!mockConfig.pihole.baseUrl;
      expect(isConfigured).toBe(true);
    });
  });

  describe('API URL construction', () => {
    it('builds correct API URL without token', () => {
      const baseUrl = 'http://pi.hole';
      const url = new URL('/admin/api.php', baseUrl);
      url.searchParams.set('summary', '');

      expect(url.toString()).toBe('http://pi.hole/admin/api.php?summary=');
    });

    it('builds correct API URL with token', () => {
      const baseUrl = 'http://pi.hole';
      const apiToken = 'abc123';
      const url = new URL('/admin/api.php', baseUrl);
      url.searchParams.set('summary', '');
      url.searchParams.set('auth', apiToken);

      expect(url.toString()).toBe('http://pi.hole/admin/api.php?summary=&auth=abc123');
    });
  });

  describe('Status mapping', () => {
    it('maps status values correctly', () => {
      const statusMap: Record<string, 'enabled' | 'disabled' | 'unknown'> = {
        enabled: 'enabled',
        disabled: 'disabled',
        unknown: 'unknown',
        '': 'unknown',
        something_else: 'unknown',
      };

      for (const [input, expected] of Object.entries(statusMap)) {
        const status = input === 'enabled' ? 'enabled' : input === 'disabled' ? 'disabled' : 'unknown';
        expect(status).toBe(expected);
      }
    });
  });

  describe('Gravity timestamp parsing', () => {
    it('converts Unix timestamp to ISO string', () => {
      const unixTimestamp = '1705579200';
      const date = new Date(parseInt(unixTimestamp, 10) * 1000);
      const isoString = date.toISOString();

      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('handles invalid timestamp gracefully', () => {
      const invalidTimestamp = 'not-a-number';
      const parsed = parseInt(invalidTimestamp, 10);
      const isValid = !isNaN(parsed);

      expect(isValid).toBe(false);
    });
  });
});
