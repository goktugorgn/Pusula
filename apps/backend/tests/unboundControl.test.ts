/**
 * Unbound stats parsing unit tests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseStats, type UnboundStats } from '../src/services/unboundControl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('unboundControl', () => {
  describe('parseStats', () => {
    it('parses full stats output correctly', () => {
      const fixture = readFileSync(join(fixturesDir, 'unbound-stats-full.txt'), 'utf-8');
      const stats = parseStats(fixture);

      // Core metrics
      expect(stats.totalQueries).toBe(123456);
      expect(stats.cacheHits).toBe(98765);
      expect(stats.cacheMisses).toBe(24691);

      // Additional metrics
      expect(stats.prefetchCount).toBe(1234);
      expect(stats.recursiveReplies).toBe(5678);
      expect(stats.servfailCount).toBe(123);
      expect(stats.nxdomainCount).toBe(456);

      // Response time (converted to ms)
      expect(stats.avgResponseTimeMs).toBeCloseTo(45.678, 1);

      // Cache hit ratio
      expect(stats.cacheHitRatio).toBeCloseTo(80, 0);

      // Raw stats should contain all parsed values
      expect(Object.keys(stats.rawStats).length).toBeGreaterThan(50);
      expect(stats.rawStats['num.query.type.A']).toBe(80000);
      expect(stats.rawStats['time.up']).toBeCloseTo(86400.123456, 2);
    });

    it('parses minimal stats with missing keys (does not crash)', () => {
      const fixture = readFileSync(join(fixturesDir, 'unbound-stats-minimal.txt'), 'utf-8');
      const stats = parseStats(fixture);

      // Present metrics
      expect(stats.totalQueries).toBe(5000);
      expect(stats.cacheHits).toBe(4000);
      expect(stats.cacheMisses).toBe(1000);
      expect(stats.nxdomainCount).toBe(400);

      // Missing metrics should default to 0
      expect(stats.prefetchCount).toBe(0);
      expect(stats.recursiveReplies).toBe(0);
      expect(stats.servfailCount).toBe(0);

      // Cache hit ratio still works
      expect(stats.cacheHitRatio).toBe(80);

      // Raw stats should have limited entries
      expect(Object.keys(stats.rawStats).length).toBe(6);
    });

    it('handles empty output gracefully', () => {
      const stats = parseStats('');

      expect(stats.totalQueries).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.cacheHitRatio).toBe(0);
      expect(stats.prefetchCount).toBe(0);
      expect(stats.recursiveReplies).toBe(0);
      expect(stats.servfailCount).toBe(0);
      expect(stats.nxdomainCount).toBe(0);
      expect(stats.avgResponseTimeMs).toBe(0);
      expect(Object.keys(stats.rawStats).length).toBe(0);
    });

    it('handles malformed lines gracefully', () => {
      const malformed = `
total.num.queries=1000
this line has no equals sign
another bad line
total.num.cachehits=500
=invalid
key_with_no_value=
`;
      const stats = parseStats(malformed);

      expect(stats.totalQueries).toBe(1000);
      expect(stats.cacheHits).toBe(500);
      // Should not crash
    });

    it('correctly calculates cache hit ratio', () => {
      const input = `
total.num.queries=100
total.num.cachehits=75
total.num.cachemiss=25
`;
      const stats = parseStats(input);

      expect(stats.cacheHitRatio).toBe(75);
    });

    it('returns 0 cache hit ratio when no queries', () => {
      const input = `
total.num.queries=0
total.num.cachehits=0
total.num.cachemiss=0
`;
      const stats = parseStats(input);

      expect(stats.cacheHitRatio).toBe(0);
    });
  });
});
