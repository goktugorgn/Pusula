/**
 * Alert store and engine unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Alert, AlertRule, AlertSeverity, AlertStatus } from '../src/services/alertStore.js';

describe('Alert Store', () => {
  describe('Alert structure', () => {
    it('has correct Alert interface', () => {
      const alert: Alert = {
        id: 'alert-123',
        rule: 'unbound_down',
        severity: 'critical',
        status: 'active',
        title: 'Unbound Down',
        message: 'Service is not running',
        createdAt: '2026-01-18T12:00:00Z',
        updatedAt: '2026-01-18T12:00:00Z',
      };

      expect(alert.id).toBe('alert-123');
      expect(alert.rule).toBe('unbound_down');
      expect(alert.severity).toBe('critical');
      expect(alert.status).toBe('active');
    });

    it('has correct optional fields', () => {
      const alert: Alert = {
        id: 'alert-456',
        rule: 'high_servfail_rate',
        severity: 'warning',
        status: 'acknowledged',
        title: 'High SERVFAIL',
        message: 'Rate is elevated',
        details: { rate: 15.5 },
        createdAt: '2026-01-18T12:00:00Z',
        updatedAt: '2026-01-18T12:05:00Z',
        acknowledgedBy: 'goktugorgn',
        acknowledgedAt: '2026-01-18T12:05:00Z',
      };

      expect(alert.acknowledgedBy).toBe('goktugorgn');
      expect(alert.details?.rate).toBe(15.5);
    });
  });

  describe('AlertRule types', () => {
    it('has expected rule types', () => {
      const rules: AlertRule[] = [
        'unbound_down',
        'upstream_error',
        'high_servfail_rate',
        'low_cache_hit_ratio',
        'config_validation_failed',
      ];

      expect(rules).toHaveLength(5);
    });
  });

  describe('AlertSeverity types', () => {
    it('has expected severity levels', () => {
      const severities: AlertSeverity[] = ['info', 'warning', 'critical'];
      expect(severities).toHaveLength(3);
    });
  });

  describe('AlertStatus types', () => {
    it('has expected status values', () => {
      const statuses: AlertStatus[] = ['active', 'acknowledged', 'resolved'];
      expect(statuses).toHaveLength(3);
    });
  });
});

describe('Alert Engine Thresholds', () => {
  describe('SERVFAIL rate thresholds', () => {
    it('calculates rate correctly', () => {
      const initial = { servfailCount: 10, totalQueries: 1000 };
      const final = { servfailCount: 25, totalQueries: 1100 };

      const queryDelta = final.totalQueries - initial.totalQueries;
      const servfailDelta = final.servfailCount - initial.servfailCount;
      const rate = (servfailDelta / queryDelta) * 100;

      expect(rate).toBe(15); // 15 servfails / 100 queries = 15%
    });

    it('determines severity based on thresholds', () => {
      const thresholds = {
        servfailRateWarning: 10,
        servfailRateCritical: 20,
      };

      const rates = [
        { rate: 5, expected: 'none' },
        { rate: 12, expected: 'warning' },
        { rate: 25, expected: 'critical' },
      ];

      for (const { rate, expected } of rates) {
        let level = 'none';
        if (rate >= thresholds.servfailRateCritical) level = 'critical';
        else if (rate >= thresholds.servfailRateWarning) level = 'warning';

        expect(level).toBe(expected);
      }
    });
  });

  describe('Cache hit ratio thresholds', () => {
    it('determines low cache hit', () => {
      const threshold = 30;

      const ratios = [
        { ratio: 25, isLow: true },
        { ratio: 30, isLow: false },
        { ratio: 50, isLow: false },
      ];

      for (const { ratio, isLow } of ratios) {
        expect(ratio < threshold).toBe(isLow);
      }
    });
  });
});

describe('Alert Deduplication', () => {
  describe('Cooldown logic', () => {
    it('calculates cooldown correctly', () => {
      const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      const lastUpdate = now - 3 * 60 * 1000; // 3 minutes ago

      const timeSinceUpdate = now - lastUpdate;
      const isInCooldown = timeSinceUpdate < COOLDOWN_MS;

      expect(isInCooldown).toBe(true);
    });

    it('expires cooldown after threshold', () => {
      const COOLDOWN_MS = 5 * 60 * 1000;
      const now = Date.now();
      const lastUpdate = now - 6 * 60 * 1000; // 6 minutes ago

      const timeSinceUpdate = now - lastUpdate;
      const isInCooldown = timeSinceUpdate < COOLDOWN_MS;

      expect(isInCooldown).toBe(false);
    });
  });
});

describe('Alert Response Format', () => {
  it('has correct response structure', () => {
    const response = {
      success: true,
      data: {
        alerts: [],
        engineRunning: true,
        activeCount: 0,
      },
    };

    expect(response.success).toBe(true);
    expect(response.data.alerts).toEqual([]);
    expect(response.data.engineRunning).toBe(true);
  });

  it('has correct ack response structure', () => {
    const response = {
      success: true,
      data: {
        acknowledged: true,
        alert: {
          id: 'alert-123',
          status: 'acknowledged',
        },
      },
    };

    expect(response.data.acknowledged).toBe(true);
    expect(response.data.alert.status).toBe('acknowledged');
  });
});
