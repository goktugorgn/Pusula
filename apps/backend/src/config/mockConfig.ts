/**
 * DEV Mode Configuration
 * Helpers for checking DEV mode and resolving paths
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory where the module is located
const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo root is 3 levels up from src/config/
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Check if running in DEV mode
 * DEV mode is enabled when UNBOUND_UI_ENV=dev
 */
export function isDevMode(): boolean {
  return process.env.UNBOUND_UI_ENV === 'dev';
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

/**
 * Get the path to mock data fixtures
 */
export function getMockDataPath(): string {
  return resolve(__dirname, '..', '..', 'mock-data');
}

/**
 * Get the base path for DEV runtime data
 * This is .local-dev/ in the repo root
 */
export function getDevDataRoot(): string {
  return resolve(REPO_ROOT, '.local-dev');
}

/**
 * Resolve a system path to its DEV equivalent
 * Maps /etc/unbound-ui/ -> .local-dev/etc/unbound-ui/
 * Maps /var/lib/unbound-ui/ -> .local-dev/var/lib/unbound-ui/
 * Maps /var/log/unbound-ui/ -> .local-dev/var/log/unbound-ui/
 */
export function resolveDevPath(systemPath: string): string {
  if (!isDevMode()) {
    return systemPath;
  }

  const devRoot = getDevDataRoot();

  // Map system paths to local dev paths
  if (systemPath.startsWith('/etc/unbound-ui/')) {
    return systemPath.replace('/etc/unbound-ui/', resolve(devRoot, 'etc/unbound-ui') + '/');
  }
  if (systemPath.startsWith('/var/lib/unbound-ui/')) {
    return systemPath.replace('/var/lib/unbound-ui/', resolve(devRoot, 'var/lib/unbound-ui') + '/');
  }
  if (systemPath.startsWith('/var/log/unbound-ui/')) {
    return systemPath.replace('/var/log/unbound-ui/', resolve(devRoot, 'var/log/unbound-ui') + '/');
  }
  if (systemPath.startsWith('/etc/unbound/')) {
    return systemPath.replace('/etc/unbound/', resolve(devRoot, 'etc/unbound') + '/');
  }

  // Path not mapped, return as-is
  return systemPath;
}

/**
 * Ensure a directory exists, creating it if necessary
 * Used for DEV mode to create .local-dev subdirectories
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the local config path, with DEV fallback
 * In DEV mode, uses .local-dev/etc/unbound-ui/
 */
export function getConfigDir(): string {
  if (isDevMode()) {
    const devConfigDir = resolve(getDevDataRoot(), 'etc/unbound-ui');
    ensureDir(devConfigDir);
    return devConfigDir;
  }
  return '/etc/unbound-ui';
}

/**
 * Get the data directory, with DEV fallback
 */
export function getDataDir(): string {
  if (isDevMode()) {
    const devDataDir = resolve(getDevDataRoot(), 'var/lib/unbound-ui');
    ensureDir(devDataDir);
    return devDataDir;
  }
  return '/var/lib/unbound-ui';
}

/**
 * Get the log directory, with DEV fallback
 */
export function getLogDir(): string {
  if (isDevMode()) {
    const devLogDir = resolve(getDevDataRoot(), 'var/log/unbound-ui');
    ensureDir(devLogDir);
    return devLogDir;
  }
  return '/var/log/unbound-ui';
}

export default {
  isDevMode,
  isTestMode,
  getMockDataPath,
  getDevDataRoot,
  resolveDevPath,
  ensureDir,
  getConfigDir,
  getDataDir,
  getLogDir,
};
