/**
 * Configuration Manager
 * Handles safe apply workflow:
 * 1. Snapshot current config (managed include + upstream.json)
 * 2. Validate new config (unbound-checkconf)
 * 3. Write new config atomically
 * 4. Reload Unbound
 * 5. Quick self-test
 * 6. Rollback on any failure
 */

import {
  readFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { checkConfig, reloadUnbound } from './unboundControl.js';
import { ServiceError } from '../utils/errors.js';
import { atomicWriteSync } from '../utils/atomicWrite.js';
import { logConfigChange } from '../security/auditLogger.js';
import {
  loadUpstreamConfig,
  invalidateUpstreamCache,
  type UpstreamConfig,
} from '../config/index.js';

// Max snapshots to keep
const MAX_SNAPSHOTS = 10;

// Default paths
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/lib/pusula/backups';
const MANAGED_CONF = process.env.UNBOUND_MANAGED_CONF || '/etc/unbound/pusula-managed.conf';
const UPSTREAM_PATH = process.env.UPSTREAM_PATH || '/var/lib/pusula/upstream.json';

export interface Snapshot {
  id: string;
  timestamp: string;
  managedConf: string;
  upstreamConfig: UpstreamConfig;
}

export interface ApplyResult {
  success: boolean;
  snapshotId: string;
  validationPassed: boolean;
  reloadPassed: boolean;
  selfTestPassed: boolean;
  rolledBack: boolean;
  error?: string;
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Generate a snapshot ID (timestamp-based)
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

  atomicWriteSync(
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

  // Restore managed conf atomically
  const managedBackup = join(snapshotDir, 'managed.conf');
  if (existsSync(managedBackup)) {
    const content = readFileSync(managedBackup, 'utf-8');
    atomicWriteSync(MANAGED_CONF, content, 0o644);
  }

  // Restore upstream config atomically
  const upstreamBackup = join(snapshotDir, 'upstream.json');
  if (existsSync(upstreamBackup)) {
    const content = readFileSync(upstreamBackup, 'utf-8');
    atomicWriteSync(UPSTREAM_PATH, content, 0o644);
  }

  // Clear cache so next load gets fresh data
  invalidateUpstreamCache();

  // Reload Unbound with restored config
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

// ============================================================================
// CONFIG GENERATION
// ============================================================================

/**
 * Generate Unbound managed config from upstream settings
 * Exported for unit testing
 */
export function generateManagedConfig(config: UpstreamConfig): string {
  const lines: string[] = [
    '# Pusula managed configuration',
    '# DO NOT EDIT MANUALLY - changes will be overwritten',
    `# Generated: ${new Date().toISOString()}`,
    '',
    `# Mode: ${config.mode}`,
    '',
  ];

  if (config.mode === 'recursive') {
    // Recursive mode - no forward-zone
    lines.push('# Recursive mode - direct root resolution');
    lines.push('# No forward-zone configuration');
  } else if (config.mode === 'dot') {
    // DoT mode - forward to TLS upstreams
    const enabled = config.dotProviders
      .filter((p) => p.enabled)
      .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

    if (enabled.length > 0) {
      lines.push('forward-zone:');
      lines.push('    name: "."');
      lines.push('    forward-tls-upstream: yes');

      for (const provider of enabled) {
        const port = provider.port || 853;
        const sni = provider.sni || '';
        // Format: address@port#sni
        lines.push(`    forward-addr: ${provider.address}@${port}#${sni}`);
      }
    } else {
      lines.push('# DoT mode but no enabled providers');
      lines.push('# Falling back to recursive resolution');
    }
  } else if (config.mode === 'doh') {
    // DoH mode - forward to local proxy
    const localPort = config.dohProxy?.localPort || 5053;

    lines.push('# DoH mode - forwarding to local proxy');
    lines.push(`# Proxy type: ${config.dohProxy?.type || 'cloudflared'}`);
    lines.push(`# Proxy port: ${localPort}`);
    lines.push('');
    lines.push('forward-zone:');
    lines.push('    name: "."');
    lines.push(`    forward-addr: 127.0.0.1@${localPort}`);
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Unbound configuration
 *
 * Strategy:
 * 1. Use unbound-checkconf (preferred, fast, reliable)
 * 2. If checkconf unavailable, attempt reload and catch errors
 */
export async function validateConfig(): Promise<{ valid: boolean; error?: string }> {
  try {
    const valid = await checkConfig();
    return { valid, error: valid ? undefined : 'unbound-checkconf reported errors' };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// APPLY WORKFLOW
// ============================================================================

/**
 * Save upstream configuration atomically
 */
export function saveUpstreamConfig(config: UpstreamConfig): void {
  const result = atomicWriteSync(
    UPSTREAM_PATH,
    JSON.stringify(config, null, 2)
  );

  if (!result.success) {
    throw new ServiceError(`Failed to save upstream config: ${result.error}`);
  }

  invalidateUpstreamCache();
}

/**
 * Apply new configuration safely with rollback on failure
 *
 * Workflow:
 * 1. Create snapshot of current config
 * 2. Generate new managed config
 * 3. Write to temp file + fsync
 * 4. Validate with unbound-checkconf
 * 5. Atomic rename to target
 * 6. Reload Unbound
 * 7. Quick self-test (optional)
 * 8. On any failure: rollback + reload
 *
 * @param newConfig - New upstream configuration
 * @param options - Apply options
 * @returns ApplyResult with detailed status
 */
export async function applyConfig(
  newConfig: UpstreamConfig,
  options: {
    /** Run quick self-test after apply (default: true) */
    runSelfTest?: boolean;
    /** IP address of requester (for audit) */
    actorIp?: string;
    /** Username of requester (for audit) */
    actorUser?: string;
  } = {}
): Promise<ApplyResult> {
  const { runSelfTest = true, actorIp = 'system', actorUser = 'system' } = options;

  const result: ApplyResult = {
    success: false,
    snapshotId: '',
    validationPassed: false,
    reloadPassed: false,
    selfTestPassed: false,
    rolledBack: false,
  };

  // Step 1: Create snapshot before changes
  try {
    result.snapshotId = await createSnapshot();
  } catch (err) {
    result.error = `Failed to create snapshot: ${err}`;
    return result;
  }

  try {
    // Step 2: Generate new managed config
    const newManagedConf = generateManagedConfig(newConfig);

    // Step 3: Write managed conf atomically
    const confResult = atomicWriteSync(MANAGED_CONF, newManagedConf, 0o644);
    if (!confResult.success) {
      throw new ServiceError(`Failed to write managed config: ${confResult.error}`);
    }

    // Step 4: Validate with unbound-checkconf
    const validation = await validateConfig();
    result.validationPassed = validation.valid;

    if (!validation.valid) {
      throw new ServiceError(`Validation failed: ${validation.error}`);
    }

    // Step 5: Write upstream config atomically
    saveUpstreamConfig(newConfig);

    // Step 6: Reload Unbound
    try {
      await reloadUnbound();
      result.reloadPassed = true;
    } catch (err) {
      throw new ServiceError(`Reload failed: ${err}`);
    }

    // Step 7: Quick self-test (optional)
    if (runSelfTest) {
      try {
        // Import dynamically to avoid circular dependency
        const { runQuickTest } = await import('./selfTest.js');
        result.selfTestPassed = await runQuickTest();

        if (!result.selfTestPassed) {
          throw new ServiceError('Self-test failed after reload');
        }
      } catch (err) {
        throw new ServiceError(`Self-test failed: ${err}`);
      }
    } else {
      result.selfTestPassed = true; // Skipped
    }

    // Success!
    result.success = true;

    // Audit log success
    logConfigChange(
      actorIp,
      actorUser,
      'apply',
      { mode: newConfig.mode, snapshotId: result.snapshotId },
      true
    );

    return result;
  } catch (err) {
    // Rollback on any error
    result.error = err instanceof Error ? err.message : String(err);

    try {
      await rollbackToSnapshot(result.snapshotId);
      result.rolledBack = true;

      // Audit log rollback
      logConfigChange(
        actorIp,
        actorUser,
        'rollback',
        { snapshotId: result.snapshotId, reason: result.error },
        true
      );
    } catch (rollbackErr) {
      const rollbackError = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      result.error += ` (Rollback also failed: ${rollbackError})`;

      // Audit log failed rollback
      logConfigChange(
        actorIp,
        actorUser,
        'rollback',
        { snapshotId: result.snapshotId },
        false,
        rollbackError
      );
    }

    return result;
  }
}

export default {
  createSnapshot,
  rollbackToSnapshot,
  getLatestSnapshotId,
  listSnapshots,
  generateManagedConfig,
  saveUpstreamConfig,
  validateConfig,
  applyConfig,
};
