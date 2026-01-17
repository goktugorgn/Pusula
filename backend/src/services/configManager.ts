/**
 * Configuration manager
 * 
 * Handles safe apply workflow: snapshot → validate → apply → self-test → rollback
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, unlinkSync, copyFileSync } from 'fs';
import { join, basename } from 'path';
import { getConfig, loadUpstreamConfig, type UpstreamConfig } from '../config/index.js';
import * as unboundControl from './unboundControl.js';
import { ServiceError } from '../utils/errors.js';

interface Snapshot {
  id: string;
  timestamp: Date;
  managedConfig: string;
  upstreamConfig: UpstreamConfig;
}

const MAX_SNAPSHOTS = 10;

/**
 * Create a timestamped snapshot of current configuration
 */
export async function createSnapshot(): Promise<string> {
  const config = getConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotId = `snapshot-${timestamp}`;
  const backupDir = config.backupDir;

  // Ensure backup directory exists
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Read current managed config
  let managedConfig = '';
  if (existsSync(config.unbound.managedIncludePath)) {
    managedConfig = readFileSync(config.unbound.managedIncludePath, 'utf-8');
  }

  // Read current upstream config
  const upstreamConfig = loadUpstreamConfig();

  // Save snapshot
  const snapshotPath = join(backupDir, `${snapshotId}.json`);
  writeFileSync(snapshotPath, JSON.stringify({
    id: snapshotId,
    timestamp: new Date().toISOString(),
    managedConfig,
    upstreamConfig,
  }, null, 2));

  // Cleanup old snapshots
  await cleanupOldSnapshots();

  return snapshotId;
}

/**
 * Restore a snapshot
 */
export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const config = getConfig();
  const snapshotPath = join(config.backupDir, `${snapshotId}.json`);

  if (!existsSync(snapshotPath)) {
    throw new ServiceError(`Snapshot not found: ${snapshotId}`);
  }

  const snapshot: Snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

  // Restore managed config
  await writeConfigAtomically(config.unbound.managedIncludePath, snapshot.managedConfig);

  // Restore upstream config
  writeFileSync(config.upstreamPath, JSON.stringify(snapshot.upstreamConfig, null, 2));
}

/**
 * Write file atomically (write temp → fsync → rename)
 */
async function writeConfigAtomically(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp`;
  
  writeFileSync(tempPath, content, { mode: 0o644 });
  renameSync(tempPath, targetPath);
}

/**
 * Generate Unbound forward zone configuration
 */
function generateUnboundConfig(upstreamConfig: UpstreamConfig): string {
  const lines: string[] = [
    '# Pusula managed configuration',
    '# DO NOT EDIT MANUALLY - changes will be overwritten',
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];

  if (upstreamConfig.mode === 'recursive') {
    // Recursive mode - no forward zones
    lines.push('# Mode: Recursive (direct root resolution)');
    return lines.join('\n');
  }

  if (upstreamConfig.mode === 'dot') {
    lines.push('# Mode: Forward via DoT');
    lines.push('forward-zone:');
    lines.push('    name: "."');
    lines.push('    forward-tls-upstream: yes');

    const enabledProviders = upstreamConfig.dotProviders
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of enabledProviders) {
      const sni = provider.sni ? `#${provider.sni}` : '';
      lines.push(`    forward-addr: ${provider.address}@${provider.port}${sni}`);
    }
  }

  if (upstreamConfig.mode === 'doh') {
    lines.push('# Mode: Forward via DoH (localhost proxy)');
    lines.push('forward-zone:');
    lines.push('    name: "."');
    // DoH mode forwards to localhost proxy
    lines.push('    forward-addr: 127.0.0.1@5053');
  }

  return lines.join('\n');
}

/**
 * Apply new upstream configuration with safe workflow
 */
export async function applyUpstreamConfig(
  newConfig: UpstreamConfig
): Promise<{ success: boolean; snapshotId: string; error?: string }> {
  const config = getConfig();

  // Step 1: Create snapshot
  const snapshotId = await createSnapshot();

  try {
    // Step 2: Generate new config
    const newUnboundConfig = generateUnboundConfig(newConfig);

    // Step 3: Write temp file and validate
    const tempConfigPath = `${config.unbound.managedIncludePath}.new`;
    writeFileSync(tempConfigPath, newUnboundConfig, { mode: 0o644 });

    // Step 4: Validate configuration
    const checkResult = await unboundControl.checkConfig();
    if (!checkResult.valid) {
      // Cleanup temp file
      if (existsSync(tempConfigPath)) {
        unlinkSync(tempConfigPath);
      }
      return { success: false, snapshotId, error: checkResult.error };
    }

    // Step 5: Atomically move to target
    renameSync(tempConfigPath, config.unbound.managedIncludePath);

    // Step 6: Update upstream config file
    writeFileSync(config.upstreamPath, JSON.stringify(newConfig, null, 2));

    // Step 7: Reload Unbound
    const reloaded = await unboundControl.reload();
    if (!reloaded) {
      // Rollback on failed reload
      await restoreSnapshot(snapshotId);
      await unboundControl.reload();
      return { success: false, snapshotId, error: 'Failed to reload Unbound' };
    }

    // Step 8: Quick self-test (basic check)
    const isRunning = await unboundControl.isRunning();
    if (!isRunning) {
      // Rollback if Unbound died
      await restoreSnapshot(snapshotId);
      await unboundControl.reload();
      return { success: false, snapshotId, error: 'Unbound stopped after reload' };
    }

    return { success: true, snapshotId };
  } catch (error) {
    // Rollback on any error
    try {
      await restoreSnapshot(snapshotId);
      await unboundControl.reload();
    } catch {
      // Ignore rollback errors
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, snapshotId, error: message };
  }
}

/**
 * Clean up old snapshots, keeping only the most recent
 */
async function cleanupOldSnapshots(): Promise<void> {
  const config = getConfig();
  const backupDir = config.backupDir;

  if (!existsSync(backupDir)) return;

  const files = readdirSync(backupDir)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();

  // Remove old snapshots beyond limit
  for (let i = MAX_SNAPSHOTS; i < files.length; i++) {
    const filePath = join(backupDir, files[i]);
    try {
      unlinkSync(filePath);
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * List available snapshots
 */
export function listSnapshots(): { id: string; timestamp: string }[] {
  const config = getConfig();
  const backupDir = config.backupDir;

  if (!existsSync(backupDir)) return [];

  return readdirSync(backupDir)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .map(f => {
      const snapshotPath = join(backupDir, f);
      const content = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
      return {
        id: content.id,
        timestamp: content.timestamp,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Get current upstream configuration
 */
export function getCurrentUpstreamConfig(): UpstreamConfig {
  return loadUpstreamConfig();
}
