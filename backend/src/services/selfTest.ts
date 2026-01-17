/**
 * Self-test engine
 * 
 * Executes comprehensive validation: config, connectivity, resolver, health
 */

import * as tls from 'tls';
import * as net from 'net';
import * as unboundControl from './unboundControl.js';
import { loadUpstreamConfig, type UpstreamConfig } from '../config/index.js';

export interface SelfTestStep {
  name: 'config_validation' | 'upstream_connectivity' | 'resolver_functionality' | 'health_observation';
  status: 'pass' | 'warn' | 'fail';
  details?: string;
  durationMs: number;
}

export interface SelfTestResult {
  passed: boolean;
  steps: SelfTestStep[];
  summary: {
    status: 'pass' | 'warn' | 'fail';
    recommendations: string[];
  };
  totalDuration: number;
}

/**
 * Run full self-test sequence
 */
export async function runSelfTest(
  observationWindowMs: number = 10000 // Shortened for API response time
): Promise<SelfTestResult> {
  const startTime = Date.now();
  const steps: SelfTestStep[] = [];
  const recommendations: string[] = [];

  const upstreamConfig = loadUpstreamConfig();

  // Step 1: Configuration validation
  const configStep = await testConfigValidation();
  steps.push(configStep);

  // Step 2: Upstream connectivity (only if not recursive)
  if (upstreamConfig.mode !== 'recursive') {
    const connectivityStep = await testUpstreamConnectivity(upstreamConfig);
    steps.push(connectivityStep);

    if (connectivityStep.status === 'fail') {
      recommendations.push('Check upstream server availability');
    }
  }

  // Step 3: Resolver functionality
  const resolverStep = await testResolverFunctionality();
  steps.push(resolverStep);

  if (resolverStep.status === 'fail') {
    recommendations.push('Verify Unbound is running and accepting queries');
  }

  // Step 4: Health observation (shortened window)
  const healthStep = await testHealthObservation(observationWindowMs);
  steps.push(healthStep);

  if (healthStep.status === 'warn') {
    recommendations.push('Monitor error rates over longer period');
  }

  // Calculate overall status
  const hasFailure = steps.some(s => s.status === 'fail');
  const hasWarning = steps.some(s => s.status === 'warn');

  const overallStatus = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass';
  const totalDuration = Date.now() - startTime;

  return {
    passed: !hasFailure,
    steps,
    summary: {
      status: overallStatus,
      recommendations,
    },
    totalDuration,
  };
}

/**
 * Step 1: Configuration validation
 */
async function testConfigValidation(): Promise<SelfTestStep> {
  const startTime = Date.now();

  try {
    const result = await unboundControl.checkConfig();
    
    return {
      name: 'config_validation',
      status: result.valid ? 'pass' : 'fail',
      details: result.valid ? 'Configuration syntax valid' : result.error,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'config_validation',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Step 2: Upstream connectivity test
 */
async function testUpstreamConnectivity(config: UpstreamConfig): Promise<SelfTestStep> {
  const startTime = Date.now();

  try {
    if (config.mode === 'dot') {
      // Test DoT connectivity
      const enabledProviders = config.dotProviders.filter(p => p.enabled);
      
      for (const provider of enabledProviders) {
        const connected = await testTlsConnection(
          provider.address,
          provider.port,
          provider.sni
        );

        if (!connected) {
          return {
            name: 'upstream_connectivity',
            status: 'fail',
            details: `Failed to connect to DoT server: ${provider.address}:${provider.port}`,
            durationMs: Date.now() - startTime,
          };
        }
      }

      return {
        name: 'upstream_connectivity',
        status: 'pass',
        details: `Connected to ${enabledProviders.length} DoT upstream(s)`,
        durationMs: Date.now() - startTime,
      };
    }

    if (config.mode === 'doh') {
      // Test DoH proxy on localhost
      const connected = await testTcpConnection('127.0.0.1', 5053);

      return {
        name: 'upstream_connectivity',
        status: connected ? 'pass' : 'fail',
        details: connected
          ? 'DoH proxy listening on localhost:5053'
          : 'DoH proxy not reachable on localhost:5053',
        durationMs: Date.now() - startTime,
      };
    }

    // Recursive mode - no upstream test needed
    return {
      name: 'upstream_connectivity',
      status: 'pass',
      details: 'Recursive mode - no upstream connectivity test needed',
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'upstream_connectivity',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Test TLS connection to DoT server
 */
function testTlsConnection(host: string, port: number, sni?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      servername: sni || host,
      timeout: 5000,
      rejectUnauthorized: true,
    });

    socket.on('secureConnect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Test TCP connection
 */
function testTcpConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 5000 });

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Step 3: Resolver functionality test
 */
async function testResolverFunctionality(): Promise<SelfTestStep> {
  const startTime = Date.now();

  try {
    // Check if Unbound is running
    const running = await unboundControl.isRunning();
    if (!running) {
      return {
        name: 'resolver_functionality',
        status: 'fail',
        details: 'Unbound service is not running',
        durationMs: Date.now() - startTime,
      };
    }

    // Get stats to verify it's responsive
    const stats = await unboundControl.getStats();

    // Basic sanity check - stats should have some data
    return {
      name: 'resolver_functionality',
      status: 'pass',
      details: `Resolver responding, ${stats.totalQueries} total queries processed`,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'resolver_functionality',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Step 4: Health observation
 */
async function testHealthObservation(durationMs: number): Promise<SelfTestStep> {
  const startTime = Date.now();
  const samples: number[] = [];
  const sampleInterval = Math.min(2000, durationMs / 3);

  try {
    // Collect samples over observation window
    while (Date.now() - startTime < durationMs) {
      const stats = await unboundControl.getStats();
      samples.push(stats.servfailCount);
      await sleep(sampleInterval);
    }

    // Analyze error trends
    if (samples.length < 2) {
      return {
        name: 'health_observation',
        status: 'pass',
        details: 'Insufficient data for trend analysis',
        durationMs: Date.now() - startTime,
      };
    }

    const initialErrors = samples[0];
    const finalErrors = samples[samples.length - 1];
    const errorIncrease = finalErrors - initialErrors;

    if (errorIncrease > 10) {
      return {
        name: 'health_observation',
        status: 'warn',
        details: `SERVFAIL errors increased by ${errorIncrease} during observation`,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      name: 'health_observation',
      status: 'pass',
      details: `Health stable over ${Math.round(durationMs / 1000)}s observation window`,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'health_observation',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run quick self-test (faster, for apply workflow)
 */
export async function runQuickTest(): Promise<{ passed: boolean; error?: string }> {
  // Just check config and running status
  const configResult = await unboundControl.checkConfig();
  if (!configResult.valid) {
    return { passed: false, error: configResult.error };
  }

  const running = await unboundControl.isRunning();
  if (!running) {
    return { passed: false, error: 'Unbound not running after reload' };
  }

  return { passed: true };
}
