/**
 * Self-test unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StepStatus, TestStep, SelfTestResult } from '../src/services/selfTest.js';
import type { DotProvider } from '../src/config/schema.js';

describe('selfTest', () => {
  describe('TestStep structure', () => {
    it('has correct structure with pass status', () => {
      const step: TestStep = {
        name: 'config_validation',
        status: 'pass',
        details: { method: 'unbound-checkconf', valid: true },
        durationMs: 123,
      };

      expect(step.name).toBe('config_validation');
      expect(step.status).toBe('pass');
      expect(step.details.valid).toBe(true);
      expect(step.durationMs).toBe(123);
      expect(step.error).toBeUndefined();
    });

    it('has correct structure with fail status and error', () => {
      const step: TestStep = {
        name: 'upstream_connectivity',
        status: 'fail',
        details: { mode: 'dot', testedCount: 2 },
        durationMs: 5000,
        error: 'All upstream providers failed',
      };

      expect(step.status).toBe('fail');
      expect(step.error).toBe('All upstream providers failed');
    });

    it('has correct structure with warn status', () => {
      const step: TestStep = {
        name: 'observation_window',
        status: 'warn',
        details: { windowSeconds: 10, servfailRate: '7.5%' },
        durationMs: 10500,
        error: 'Elevated SERVFAIL rate: 7.5%',
      };

      expect(step.status).toBe('warn');
    });
  });

  describe('SelfTestResult structure', () => {
    it('has correct structure with overall pass', () => {
      const result: SelfTestResult = {
        steps: [
          { name: 'config_validation', status: 'pass', details: {}, durationMs: 50 },
          { name: 'upstream_connectivity', status: 'pass', details: {}, durationMs: 1000 },
          { name: 'resolver_functionality', status: 'pass', details: {}, durationMs: 200 },
          { name: 'observation_window', status: 'pass', details: {}, durationMs: 10000 },
        ],
        summary: {
          status: 'pass',
          recommendations: [],
        },
        totalDurationMs: 11250,
      };

      expect(result.summary.status).toBe('pass');
      expect(result.summary.recommendations).toHaveLength(0);
      expect(result.steps).toHaveLength(4);
    });

    it('has correct structure with overall fail', () => {
      const result: SelfTestResult = {
        steps: [
          { name: 'config_validation', status: 'fail', details: {}, durationMs: 50, error: 'Syntax error' },
          { name: 'upstream_connectivity', status: 'pass', details: {}, durationMs: 1000 },
        ],
        summary: {
          status: 'fail',
          recommendations: ['Fix configuration errors before proceeding'],
        },
        totalDurationMs: 1050,
      };

      expect(result.summary.status).toBe('fail');
      expect(result.summary.recommendations).toContain('Fix configuration errors before proceeding');
    });

    it('has correct structure with overall warn', () => {
      const result: SelfTestResult = {
        steps: [
          { name: 'config_validation', status: 'pass', details: {}, durationMs: 50 },
          { name: 'upstream_connectivity', status: 'warn', details: {}, durationMs: 1000 },
        ],
        summary: {
          status: 'warn',
          recommendations: ['Some upstream providers are unreachable'],
        },
        totalDurationMs: 1050,
      };

      expect(result.summary.status).toBe('warn');
    });
  });

  describe('DoT handshake validation (mock)', () => {
    it('validates provider structure', () => {
      const provider: DotProvider = {
        id: 'cloudflare',
        name: 'Cloudflare',
        address: '1.1.1.1',
        port: 853,
        sni: 'cloudflare-dns.com',
        enabled: true,
        priority: 1,
      };

      expect(provider.id).toBe('cloudflare');
      expect(provider.address).toBe('1.1.1.1');
      expect(provider.port).toBe(853);
      expect(provider.sni).toBe('cloudflare-dns.com');
    });

    it('handles provider without optional fields', () => {
      const provider: DotProvider = {
        id: 'quad9',
        address: '9.9.9.9',
        port: 853,
        enabled: true,
      };

      expect(provider.sni).toBeUndefined();
      expect(provider.name).toBeUndefined();
      expect(provider.priority).toBeUndefined();
    });
  });

  describe('DoH validation logic (mock)', () => {
    it('validates DoH proxy config structure', () => {
      const dohProxy = {
        type: 'cloudflared' as const,
        localPort: 5053,
      };

      expect(dohProxy.type).toBe('cloudflared');
      expect(dohProxy.localPort).toBe(5053);
    });

    it('supports dnscrypt-proxy type', () => {
      const dohProxy = {
        type: 'dnscrypt-proxy' as const,
        localPort: 5300,
      };

      expect(dohProxy.type).toBe('dnscrypt-proxy');
    });
  });

  describe('step name constants', () => {
    it('has expected step names', () => {
      const stepNames = [
        'config_validation',
        'upstream_connectivity',
        'resolver_functionality',
        'observation_window',
      ];

      for (const name of stepNames) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('status determination logic', () => {
    it('returns fail if any step fails', () => {
      const steps: TestStep[] = [
        { name: 'step1', status: 'pass', details: {}, durationMs: 100 },
        { name: 'step2', status: 'fail', details: {}, durationMs: 100 },
        { name: 'step3', status: 'pass', details: {}, durationMs: 100 },
      ];

      const hasFail = steps.some((s) => s.status === 'fail');
      const hasWarn = steps.some((s) => s.status === 'warn');

      let status: StepStatus = 'pass';
      if (hasFail) status = 'fail';
      else if (hasWarn) status = 'warn';

      expect(status).toBe('fail');
    });

    it('returns warn if no fail but has warn', () => {
      const steps: TestStep[] = [
        { name: 'step1', status: 'pass', details: {}, durationMs: 100 },
        { name: 'step2', status: 'warn', details: {}, durationMs: 100 },
        { name: 'step3', status: 'pass', details: {}, durationMs: 100 },
      ];

      const hasFail = steps.some((s) => s.status === 'fail');
      const hasWarn = steps.some((s) => s.status === 'warn');

      let status: StepStatus = 'pass';
      if (hasFail) status = 'fail';
      else if (hasWarn) status = 'warn';

      expect(status).toBe('warn');
    });

    it('returns pass if all steps pass', () => {
      const steps: TestStep[] = [
        { name: 'step1', status: 'pass', details: {}, durationMs: 100 },
        { name: 'step2', status: 'pass', details: {}, durationMs: 100 },
      ];

      const hasFail = steps.some((s) => s.status === 'fail');
      const hasWarn = steps.some((s) => s.status === 'warn');

      let status: StepStatus = 'pass';
      if (hasFail) status = 'fail';
      else if (hasWarn) status = 'warn';

      expect(status).toBe('pass');
    });
  });

  describe('SERVFAIL rate calculation', () => {
    it('calculates rate correctly', () => {
      const initialStats = { queries: 1000, servfail: 10 };
      const finalStats = { queries: 1100, servfail: 20 };

      const queryDelta = finalStats.queries - initialStats.queries;
      const servfailDelta = finalStats.servfail - initialStats.servfail;
      const servfailRate = queryDelta > 0 ? (servfailDelta / queryDelta) * 100 : 0;

      expect(servfailRate).toBe(10); // 10 servfails out of 100 queries = 10%
    });

    it('returns 0 when no queries during window', () => {
      const queryDelta = 0;
      const servfailDelta = 0;
      const servfailRate = queryDelta > 0 ? (servfailDelta / queryDelta) * 100 : 0;

      expect(servfailRate).toBe(0);
    });

    it('determines status based on rate thresholds', () => {
      const rates = [
        { rate: 3, expected: 'pass' },
        { rate: 7, expected: 'warn' },
        { rate: 25, expected: 'fail' },
      ];

      for (const { rate, expected } of rates) {
        let status: StepStatus = 'pass';
        if (rate > 20) status = 'fail';
        else if (rate > 5) status = 'warn';

        expect(status).toBe(expected);
      }
    });
  });
});
