/**
 * Self-Test Engine
 * Runs comprehensive DNS resolver diagnostics
 *
 * 4 Steps:
 * 1. Configuration validation
 * 2. Upstream connectivity
 * 3. Resolver functionality
 * 4. Health observation
 */

import * as tls from 'node:tls';
import * as net from 'node:net';
import { checkConfig, isUnboundRunning, getUnboundStats } from './unboundControl.js';
import { loadUpstreamConfig } from '../config/index.js';

export interface TestStep {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface TestResult {
  passed: boolean;
  steps: TestStep[];
  totalDuration: number;
}

/**
 * Run the full self-test suite
 */
export async function runSelfTest(): Promise<TestResult> {
  const startTime = Date.now();
  const steps: TestStep[] = [];

  // Step 1: Configuration validation
  steps.push(await testConfigValidation());

  // Step 2: Upstream connectivity
  steps.push(await testUpstreamConnectivity());

  // Step 3: Resolver functionality
  steps.push(await testResolverFunctionality());

  // Step 4: Health observation
  steps.push(await testHealthObservation());

  const totalDuration = Date.now() - startTime;
  const passed = steps.every((s) => s.passed);

  return { passed, steps, totalDuration };
}

/**
 * Quick test for safe-apply workflow
 */
export async function runQuickTest(): Promise<boolean> {
  // Just config validation and resolver check
  const configResult = await testConfigValidation();
  if (!configResult.passed) return false;

  const resolverResult = await testResolverFunctionality();
  return resolverResult.passed;
}

/**
 * Step 1: Validate configuration with unbound-checkconf
 */
async function testConfigValidation(): Promise<TestStep> {
  const startTime = Date.now();

  try {
    const valid = await checkConfig();
    return {
      name: 'config_validation',
      passed: valid,
      duration: Date.now() - startTime,
      error: valid ? undefined : 'Configuration validation failed',
    };
  } catch (err) {
    return {
      name: 'config_validation',
      passed: false,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Step 2: Test upstream connectivity
 */
async function testUpstreamConnectivity(): Promise<TestStep> {
  const startTime = Date.now();
  const config = loadUpstreamConfig();

  // Skip for recursive mode
  if (config.mode === 'recursive') {
    return {
      name: 'upstream_connectivity',
      passed: true,
      duration: Date.now() - startTime,
      details: { mode: 'recursive', skipped: true },
    };
  }

  const errors: string[] = [];

  if (config.mode === 'dot') {
    // Test DoT connections
    const enabled = config.dotProviders.filter((p) => p.enabled);
    for (const provider of enabled) {
      try {
        await testTlsConnection(provider.address, provider.port || 853, provider.sni);
      } catch (err) {
        errors.push(`${provider.name || provider.address}: ${err}`);
      }
    }
  } else if (config.mode === 'doh') {
    // Test local DoH proxy
    try {
      await testTcpConnection('127.0.0.1', 5053);
    } catch (err) {
      errors.push(`DoH proxy: ${err}`);
    }
  }

  return {
    name: 'upstream_connectivity',
    passed: errors.length === 0,
    duration: Date.now() - startTime,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    details: { mode: config.mode, tested: config.mode === 'dot' ? config.dotProviders.length : 1 },
  };
}

/**
 * Test TLS connection to a DoT server
 */
function testTlsConnection(host: string, port: number, sni?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);

    const socket = tls.connect(
      {
        host,
        port,
        servername: sni || host,
        rejectUnauthorized: true,
      },
      () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve();
      }
    );

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Test TCP connection to local proxy
 */
function testTcpConnection(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 3000);

    const socket = net.connect({ host, port }, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Step 3: Test resolver functionality
 */
async function testResolverFunctionality(): Promise<TestStep> {
  const startTime = Date.now();

  try {
    // Check if Unbound is running
    const running = await isUnboundRunning();
    if (!running) {
      return {
        name: 'resolver_functionality',
        passed: false,
        duration: Date.now() - startTime,
        error: 'Unbound service is not running',
      };
    }

    // Try to get stats (proves it's responding)
    await getUnboundStats();

    return {
      name: 'resolver_functionality',
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      name: 'resolver_functionality',
      passed: false,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Step 4: Health observation (quick stats check)
 */
async function testHealthObservation(): Promise<TestStep> {
  const startTime = Date.now();

  try {
    const stats = await getUnboundStats();

    // Check for high error rates
    const servfailRate = stats.totalQueries > 0
      ? (stats.servfailCount / stats.totalQueries) * 100
      : 0;

    const passed = servfailRate < 10; // Less than 10% SERVFAIL

    return {
      name: 'health_observation',
      passed,
      duration: Date.now() - startTime,
      error: passed ? undefined : `High SERVFAIL rate: ${servfailRate.toFixed(1)}%`,
      details: {
        servfailRate: servfailRate.toFixed(2),
        cacheHitRatio: stats.cacheHitRatio.toFixed(2),
        totalQueries: stats.totalQueries,
      },
    };
  } catch (err) {
    return {
      name: 'health_observation',
      passed: false,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default {
  runSelfTest,
  runQuickTest,
};
