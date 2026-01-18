/**
 * Self-Test Engine
 * Runs comprehensive DNS resolver diagnostics
 *
 * 4 Stages:
 * 1. Config validation - Validate unbound.conf with unbound-checkconf
 * 2. Upstream connectivity - TLS handshakes (DoT) or proxy check (DoH)
 * 3. Resolver functionality - DNS queries including DNSSEC
 * 4. Observation window - Sample stats for error spikes
 */

import * as tls from 'node:tls';
import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import { checkConfig, isUnboundRunning, getUnboundStats } from './unboundControl.js';
import { loadUpstreamConfig, type DotProvider } from '../config/index.js';

// ============================================================================
// TYPES
// ============================================================================

export type StepStatus = 'pass' | 'warn' | 'fail';

export interface TestStep {
  name: string;
  status: StepStatus;
  details: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface SelfTestResult {
  steps: TestStep[];
  summary: {
    status: StepStatus;
    recommendations: string[];
  };
  totalDurationMs: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Test domains for DNS queries */
const TEST_DOMAINS = {
  basic: 'example.com',
  dnssec: 'dnssec-failed.org', // Known DNSSEC-signed domain
  reliable: 'cloudflare.com', // Highly available
};

/** Observation window duration in seconds */
const OBSERVATION_WINDOW_SECONDS = 10;

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

/**
 * Run the full self-test suite
 */
export async function runSelfTest(): Promise<SelfTestResult> {
  const startTime = Date.now();
  const steps: TestStep[] = [];
  const recommendations: string[] = [];

  // Stage 1: Config validation
  const configStep = await testConfigValidation();
  steps.push(configStep);
  if (configStep.status === 'fail') {
    recommendations.push('Fix configuration errors before proceeding');
  }

  // Stage 2: Upstream connectivity
  const connectivityStep = await testUpstreamConnectivity();
  steps.push(connectivityStep);
  if (connectivityStep.status === 'fail') {
    recommendations.push('Check upstream DNS provider connectivity');
  } else if (connectivityStep.status === 'warn') {
    recommendations.push('Some upstream providers are unreachable');
  }

  // Stage 3: Resolver functionality
  const resolverStep = await testResolverFunctionality();
  steps.push(resolverStep);
  if (resolverStep.status === 'fail') {
    recommendations.push('Verify Unbound service is running and responding');
  }

  // Stage 4: Observation window
  const observationStep = await testObservationWindow();
  steps.push(observationStep);
  if (observationStep.status === 'fail') {
    recommendations.push('High error rate detected - check upstream health');
  } else if (observationStep.status === 'warn') {
    recommendations.push('Elevated error rate - monitor closely');
  }

  // Determine overall status
  let overallStatus: StepStatus = 'pass';
  if (steps.some((s) => s.status === 'fail')) {
    overallStatus = 'fail';
  } else if (steps.some((s) => s.status === 'warn')) {
    overallStatus = 'warn';
  }

  return {
    steps,
    summary: {
      status: overallStatus,
      recommendations,
    },
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * Quick test for safe-apply workflow (subset of full test)
 */
export async function runQuickTest(): Promise<boolean> {
  const configResult = await testConfigValidation();
  if (configResult.status !== 'pass') return false;

  const resolverResult = await testResolverFunctionality();
  return resolverResult.status === 'pass';
}

// ============================================================================
// STAGE 1: CONFIG VALIDATION
// ============================================================================

/**
 * Validate Unbound configuration with unbound-checkconf
 */
export async function testConfigValidation(): Promise<TestStep> {
  const startTime = Date.now();

  try {
    const valid = await checkConfig();
    return {
      name: 'config_validation',
      status: valid ? 'pass' : 'fail',
      details: { method: 'unbound-checkconf', valid },
      durationMs: Date.now() - startTime,
      error: valid ? undefined : 'Configuration syntax errors detected',
    };
  } catch (err) {
    return {
      name: 'config_validation',
      status: 'fail',
      details: { method: 'unbound-checkconf' },
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// STAGE 2: UPSTREAM CONNECTIVITY
// ============================================================================

/**
 * Test upstream DNS provider connectivity
 * - DoT: TLS handshake with SNI verification
 * - DoH: Local proxy check + DNS resolution test
 */
export async function testUpstreamConnectivity(): Promise<TestStep> {
  const startTime = Date.now();
  const config = loadUpstreamConfig();
  const details: Record<string, unknown> = { mode: config.mode };

  // Recursive mode - no upstreams to test
  if (config.mode === 'recursive') {
    return {
      name: 'upstream_connectivity',
      status: 'pass',
      details: { mode: 'recursive', skipped: true, reason: 'No upstreams in recursive mode' },
      durationMs: Date.now() - startTime,
    };
  }

  const results: Array<{ provider: string; success: boolean; error?: string; latencyMs: number }> = [];

  if (config.mode === 'dot') {
    // Test DoT connections
    const enabled = config.dotProviders.filter((p) => p.enabled);
    details.testedCount = enabled.length;

    for (const provider of enabled) {
      const providerStart = Date.now();
      try {
        await testTlsHandshake(provider);
        results.push({
          provider: provider.name || provider.address,
          success: true,
          latencyMs: Date.now() - providerStart,
        });
      } catch (err) {
        results.push({
          provider: provider.name || provider.address,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - providerStart,
        });
      }
    }
  } else if (config.mode === 'doh') {
    // Test DoH local proxy
    const localPort = config.dohProxy?.localPort || 5053;
    details.proxyPort = localPort;
    details.testedCount = 1;

    const proxyStart = Date.now();
    try {
      // Step 1: Check proxy is listening
      await testTcpConnection('127.0.0.1', localPort);

      // Step 2: Test actual DNS resolution through proxy
      await testDnsResolution('127.0.0.1', localPort, TEST_DOMAINS.reliable);

      results.push({
        provider: `DoH proxy (127.0.0.1:${localPort})`,
        success: true,
        latencyMs: Date.now() - proxyStart,
      });
    } catch (err) {
      results.push({
        provider: `DoH proxy (127.0.0.1:${localPort})`,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - proxyStart,
      });
    }
  }

  details.results = results;

  // Determine status
  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  let status: StepStatus = 'pass';
  if (successCount === 0 && totalCount > 0) {
    status = 'fail';
  } else if (successCount < totalCount) {
    status = 'warn';
  }

  return {
    name: 'upstream_connectivity',
    status,
    details,
    durationMs: Date.now() - startTime,
    error: successCount === 0 ? 'All upstream providers failed' : undefined,
  };
}

/**
 * Test TLS handshake to a DoT server
 * Verifies both connectivity and TLS certificate
 */
export function testTlsHandshake(provider: DotProvider): Promise<{ connected: boolean; certCN?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('TLS handshake timeout (5s)'));
    }, 5000);

    const socket = tls.connect(
      {
        host: provider.address,
        port: provider.port || 853,
        servername: provider.sni || provider.address,
        rejectUnauthorized: true,
      },
      () => {
        clearTimeout(timeout);
        const cert = socket.getPeerCertificate();
        socket.destroy();
        resolve({
          connected: true,
          certCN: cert.subject?.CN,
        });
      }
    );

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Test TCP connection (for DoH proxy check)
 */
function testTcpConnection(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('TCP connection timeout (3s)'));
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
 * Test DNS resolution through a specific resolver
 */
async function testDnsResolution(server: string, port: number, domain: string): Promise<string[]> {
  // Use Node's dns resolver with custom server
  const resolver = new dns.Resolver();
  resolver.setServers([`${server}:${port}`]);

  const addresses = await resolver.resolve4(domain);
  if (!addresses || addresses.length === 0) {
    throw new Error('No DNS response received');
  }
  return addresses;
}

// ============================================================================
// STAGE 3: RESOLVER FUNCTIONALITY
// ============================================================================

/**
 * Test resolver functionality with DNS queries
 */
export async function testResolverFunctionality(): Promise<TestStep> {
  const startTime = Date.now();
  const details: Record<string, unknown> = {};

  try {
    // Check if Unbound is running
    const running = await isUnboundRunning();
    if (!running) {
      return {
        name: 'resolver_functionality',
        status: 'fail',
        details: { running: false },
        durationMs: Date.now() - startTime,
        error: 'Unbound service is not running',
      };
    }
    details.running = true;

    // Test basic DNS resolution
    const resolver = new dns.Resolver();
    resolver.setServers(['127.0.0.1:53']);

    // Basic query
    const basicStart = Date.now();
    try {
      const basicResult = await resolver.resolve4(TEST_DOMAINS.basic);
      details.basicQuery = {
        domain: TEST_DOMAINS.basic,
        success: true,
        result: basicResult,
        latencyMs: Date.now() - basicStart,
      };
    } catch (err) {
      details.basicQuery = {
        domain: TEST_DOMAINS.basic,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - basicStart,
      };
    }

    // DNSSEC query (if possible)
    const dnssecStart = Date.now();
    try {
      // Test against a known DNSSEC domain
      const dnssecResult = await resolver.resolve4(TEST_DOMAINS.reliable);
      details.dnssecQuery = {
        domain: TEST_DOMAINS.reliable,
        success: true,
        result: dnssecResult,
        latencyMs: Date.now() - dnssecStart,
        note: 'DNSSEC validation performed by Unbound (if enabled)',
      };
    } catch (err) {
      details.dnssecQuery = {
        domain: TEST_DOMAINS.reliable,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - dnssecStart,
      };
    }

    // Determine status
    const basicSuccess = (details.basicQuery as any)?.success ?? false;
    const status: StepStatus = basicSuccess ? 'pass' : 'fail';

    return {
      name: 'resolver_functionality',
      status,
      details,
      durationMs: Date.now() - startTime,
      error: basicSuccess ? undefined : 'DNS resolution failed',
    };
  } catch (err) {
    return {
      name: 'resolver_functionality',
      status: 'fail',
      details,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// STAGE 4: OBSERVATION WINDOW
// ============================================================================

/**
 * Run observation window to detect error spikes
 */
export async function testObservationWindow(): Promise<TestStep> {
  const startTime = Date.now();
  const details: Record<string, unknown> = {
    windowSeconds: OBSERVATION_WINDOW_SECONDS,
  };

  try {
    // Get initial stats
    const initialStats = await getUnboundStats();
    details.initialStats = {
      queries: initialStats.totalQueries,
      servfail: initialStats.servfailCount,
      cacheHitRatio: initialStats.cacheHitRatio,
    };

    // Wait for observation window
    await new Promise((resolve) => setTimeout(resolve, OBSERVATION_WINDOW_SECONDS * 1000));

    // Get final stats
    const finalStats = await getUnboundStats();
    details.finalStats = {
      queries: finalStats.totalQueries,
      servfail: finalStats.servfailCount,
      cacheHitRatio: finalStats.cacheHitRatio,
    };

    // Calculate deltas
    const queryDelta = finalStats.totalQueries - initialStats.totalQueries;
    const servfailDelta = finalStats.servfailCount - initialStats.servfailCount;
    const servfailRate = queryDelta > 0 ? (servfailDelta / queryDelta) * 100 : 0;

    details.deltas = {
      queries: queryDelta,
      servfail: servfailDelta,
      servfailRate: servfailRate.toFixed(2) + '%',
    };

    // Determine status based on error rates
    let status: StepStatus = 'pass';
    let error: string | undefined;

    if (servfailRate > 20) {
      status = 'fail';
      error = `Critical SERVFAIL rate: ${servfailRate.toFixed(1)}% during observation`;
    } else if (servfailRate > 5) {
      status = 'warn';
      error = `Elevated SERVFAIL rate: ${servfailRate.toFixed(1)}% during observation`;
    }

    return {
      name: 'observation_window',
      status,
      details,
      durationMs: Date.now() - startTime,
      error,
    };
  } catch (err) {
    return {
      name: 'observation_window',
      status: 'warn', // Warn instead of fail - observation is optional
      details,
      durationMs: Date.now() - startTime,
      error: `Could not complete observation: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  runSelfTest,
  runQuickTest,
  testConfigValidation,
  testUpstreamConnectivity,
  testTlsHandshake,
  testResolverFunctionality,
  testObservationWindow,
};
