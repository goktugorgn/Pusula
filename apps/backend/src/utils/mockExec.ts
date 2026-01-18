/**
 * Mock Command Execution for DEV Mode
 *
 * Intercepts safeExec calls in DEV mode and returns fixture data
 * instead of executing real system commands.
 */

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMockDataPath, getLogDir, isDevMode, ensureDir } from '../config/mockConfig.js';
import type { ExecResult } from './safeExec.js';

// ============================================================================
// FIXTURE FILE MAPPING
// ============================================================================

/**
 * Map command IDs to fixture file paths
 */
const FIXTURE_MAP: Record<string, string> = {
  // unbound-control commands
  'unbound-status': 'unbound-control/status.txt',
  'unbound-stats': 'unbound-control/stats_noreset.txt',
  
  // systemctl commands
  'systemctl-is-active': 'systemctl/is-active-unbound.txt',
  'systemctl-status': 'systemctl/status-unbound.txt',
  
  // journalctl commands
  'journalctl-read': 'journalctl/unbound.log',
  'journalctl-since': 'journalctl/unbound.log',
};

/**
 * Commands that modify state (should be logged but not executed)
 */
const STATE_CHANGING_COMMANDS = [
  'unbound-reload',
  'unbound-flush-all',
  'unbound-flush-zone',
  'unbound-flush-request',
  'systemctl-reload',
  'systemctl-restart',
];

/**
 * Commands that validate config (return success in DEV)
 */
const VALIDATION_COMMANDS = [
  'unbound-checkconf',
  'unbound-checkconf-file',
];

// ============================================================================
// MOCK EXECUTION
// ============================================================================

/**
 * Execute a mock command in DEV mode
 * Returns fixture data for read commands, logs state-changing commands
 */
export async function mockExec(
  commandId: string,
  params: Record<string, string> = {}
): Promise<ExecResult> {
  const startTime = Date.now();

  // Log the mock execution for debugging
  if (process.env.DEBUG) {
    console.log(`[mockExec] ${commandId}`, params);
  }

  // Handle state-changing commands
  if (STATE_CHANGING_COMMANDS.includes(commandId)) {
    logMockAction(commandId, params);
    return createSuccessResult(startTime, `Mock: ${commandId} executed successfully\n`);
  }

  // Handle validation commands
  if (VALIDATION_COMMANDS.includes(commandId)) {
    return createSuccessResult(startTime, 'unbound-checkconf: no errors in /etc/unbound/unbound.conf\n');
  }

  // Handle commands with fixture files
  const fixturePath = FIXTURE_MAP[commandId];
  if (fixturePath) {
    const content = readFixture(fixturePath);
    if (content !== null) {
      return createSuccessResult(startTime, content);
    }
  }

  // Unknown command - return generic success
  console.warn(`[mockExec] No fixture for command: ${commandId}`);
  return createSuccessResult(startTime, '');
}

/**
 * Read a fixture file
 */
function readFixture(relativePath: string): string | null {
  const mockDataPath = getMockDataPath();
  const fullPath = resolve(mockDataPath, relativePath);

  if (!existsSync(fullPath)) {
    console.warn(`[mockExec] Fixture not found: ${fullPath}`);
    return null;
  }

  try {
    return readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error(`[mockExec] Error reading fixture ${fullPath}:`, err);
    return null;
  }
}

/**
 * Log a mock state-changing action
 */
function logMockAction(commandId: string, params: Record<string, string>): void {
  if (!isDevMode()) return;

  const logDir = getLogDir();
  ensureDir(logDir);

  const logPath = resolve(logDir, 'mock-actions.log');
  const entry = {
    timestamp: new Date().toISOString(),
    command: commandId,
    params,
  };

  try {
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error(`[mockExec] Failed to log action:`, err);
  }
}

/**
 * Create a successful ExecResult
 */
function createSuccessResult(startTime: number, stdout: string): ExecResult {
  return {
    code: 0,
    stdout,
    stderr: '',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Create a failed ExecResult
 */
export function createFailureResult(
  startTime: number,
  exitCode: number,
  stderr: string
): ExecResult {
  return {
    code: exitCode,
    stdout: '',
    stderr,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// SELF-TEST MOCK
// ============================================================================

/**
 * Get mock self-test results
 * Toggle between pass/fail based on env var MOCK_SELFTEST_FAIL
 */
export function getMockSelfTestResult(): unknown {
  const mockDataPath = getMockDataPath();
  const shouldFail = process.env.MOCK_SELFTEST_FAIL === 'true';
  const filename = shouldFail ? 'selftest/fail.json' : 'selftest/pass.json';
  const fullPath = resolve(mockDataPath, filename);

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[mockExec] Failed to read self-test fixture:`, err);
    return null;
  }
}

export default mockExec;
