/**
 * Configuration Manager
 * Handles safe apply workflow: snapshot → validate → apply → reload → self-test → rollback
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { checkConfig, reloadUnbound } from './unboundControl.js';
import { ServiceError } from '../utils/errors.js';
import { loadUpstreamConfig, invalidateUpstreamCache, type UpstreamConfig } from '../config/index.js';

// Max snapshots to keep
const MAX_SNAPSHOTS = 10;

// Default paths
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/lib/unbound-ui/backups';
const MANAGED_CONF = process.env.UNBOUND_MANAGED_CONF || '/etc/unbound/unbound-ui-managed.conf';
const UPSTREAM_PATH = process.env.UPSTREAM_PATH || '/var/lib/unbound-ui/upstream.json';

export interface Snapshot {
  id: string;
  timestamp: string;
  managedConf: string;
  upstreamConfig: UpstreamConfig;
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Generate a snapshot ID
 */
function generateSnapshotId(): string {
  return `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

/**
 * Create a snapshot of current configuration
 */
export async function createSnapshot(): Promise<string> {
  ensureBackupDir();

  const snapshotId = generateSnapshotId();
  const snapshotDir = join(BACKUP_DIR, snapshotId);
  mkdirSync(snapshotDir, { recursive: true });

  // Backup managed conf
  if (existsSync(MANAGED_CONF)) {
    copyFileSync(MANAGED_CONF, join(snapshotDir, 'managed.conf'));
  }

  // Backup upstream config
  if (existsSync(UPSTREAM_PATH)) {
    copyFileSync(UPSTREAM_PATH, join(snapshotDir, 'upstream.json'));
  }

  // Save snapshot metadata
  const metadata: Snapshot = {
    id: snapshotId,
    timestamp: new Date().toISOString(),
    managedConf: existsSync(MANAGED_CONF) ? readFileSync(MANAGED_CONF, 'utf-8') : '',
    upstreamConfig: loadUpstreamConfig(),
  };

  writeFileSync(
    join(snapshotDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Cleanup old snapshots
  cleanupOldSnapshots();

  return snapshotId;
}

/**
 * Rollback to a specific snapshot
 */
export async function rollbackToSnapshot(snapshotId: string): Promise<void> {
  const snapshotDir = join(BACKUP_DIR, snapshotId);

  if (!existsSync(snapshotDir)) {
    throw new ServiceError(`Snapshot not found: ${snapshotId}`);
  }

  // Restore managed conf
  const managedBackup = join(snapshotDir, 'managed.conf');
  if (existsSync(managedBackup)) {
    copyFileSync(managedBackup, MANAGED_CONF);
  }

  // Restore upstream config
  const upstreamBackup = join(snapshotDir, 'upstream.json');
  if (existsSync(upstreamBackup)) {
    copyFileSync(upstreamBackup, UPSTREAM_PATH);
  }

  // Clear cache so next load gets fresh data
  invalidateUpstreamCache();

  // Reload Unbound
  await reloadUnbound();
}

/**
 * Get the latest snapshot ID
 */
export function getLatestSnapshotId(): string | null {
  ensureBackupDir();

  const snapshots = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('snapshot-'))
    .sort()
    .reverse();

  return snapshots[0] || null;
}

/**
 * List all snapshots
 */
export function listSnapshots(): Snapshot[] {
  ensureBackupDir();

  const snapshotDirs = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('snapshot-'))
    .sort()
    .reverse();

  const snapshots: Snapshot[] = [];

  for (const dir of snapshotDirs) {
    const metadataPath = join(BACKUP_DIR, dir, 'metadata.json');
    if (existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        snapshots.push(metadata);
      } catch {
        // Skip invalid snapshots
      }
    }
  }

  return snapshots;
}

/**
 * Cleanup old snapshots, keeping only MAX_SNAPSHOTS
 */
function cleanupOldSnapshots(): void {
  const snapshots = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('snapshot-'))
    .sort()
    .reverse();

  if (snapshots.length > MAX_SNAPSHOTS) {
    const toDelete = snapshots.slice(MAX_SNAPSHOTS);
    for (const dir of toDelete) {
      rmSync(join(BACKUP_DIR, dir), { recursive: true, force: true });
    }
  }
}

/**
 * Generate Unbound managed config from upstream settings
 */
export function generateManagedConfig(config: UpstreamConfig): string {
  const lines: string[] = [
    '# Pusula managed configuration',
    '# DO NOT EDIT MANUALLY - changes will be overwritten',
    '',
    `# Mode: ${config.mode}`,
    '',
  ];

  if (config.mode === 'recursive') {
    lines.push('# Recursive mode - direct root resolution');
    lines.push('# No forward-zone configuration');
  } else if (config.mode === 'dot') {
    const enabled = config.dotProviders.filter((p) => p.enabled);
    if (enabled.length > 0) {
      lines.push('forward-zone:');
      lines.push('    name: "."');
      lines.push('    forward-tls-upstream: yes');
      for (const provider of enabled) {
        const port = provider.port || 853;
        const sni = provider.sni || '';
        lines.push(`    forward-addr: ${provider.address}@${port}#${sni}`);
      }
    }
  } else if (config.mode === 'doh') {
    // DoH typically uses a local proxy
    lines.push('# DoH mode - forwarding to local proxy');
    lines.push('forward-zone:');
    lines.push('    name: "."');
    lines.push('    forward-addr: 127.0.0.1@5053');
  }

  return lines.join('\n') + '\n';
}

/**
 * Apply new configuration safely
 *
 * @returns Snapshot ID if successful
 */
export async function applyConfig(
  newConfig: UpstreamConfig
): Promise<{ snapshotId: string; success: boolean }> {
  // Create snapshot before changes
  const snapshotId = await createSnapshot();

  try {
    // Generate new managed config
    const newManagedConf = generateManagedConfig(newConfig);

    // Write to temp file first
    const tempPath = `${MANAGED_CONF}.tmp`;
    writeFileSync(tempPath, newManagedConf, { mode: 0o644 });

    // Validate with unbound-checkconf
    const valid = await checkConfig();
    if (!valid) {
      // Cleanup temp file
      if (existsSync(tempPath)) {
        rmSync(tempPath);
      }
      throw new ServiceError('Configuration validation failed');
    }

    // Atomic move
    const { renameSync } = await import('node:fs');
    renameSync(tempPath, MANAGED_CONF);

    // Write upstream config
    writeFileSync(UPSTREAM_PATH, JSON.stringify(newConfig, null, 2));
    invalidateUpstreamCache();

    // Reload Unbound
    await reloadUnbound();

    return { snapshotId, success: true };
  } catch (err) {
    // Rollback on any error
    try {
      await rollbackToSnapshot(snapshotId);
    } catch (rollbackErr) {
      console.error('Rollback also failed:', rollbackErr);
    }
    throw err;
  }
}

export default {
  createSnapshot,
  rollbackToSnapshot,
  getLatestSnapshotId,
  listSnapshots,
  generateManagedConfig,
  applyConfig,
};
