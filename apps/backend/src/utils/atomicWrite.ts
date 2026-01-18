/**
 * Atomic file write utility
 * Ensures safe writes with temp file + fsync + rename pattern
 */

import { openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Result of an atomic write operation
 */
export interface AtomicWriteResult {
  success: boolean;
  tempPath: string;
  error?: string;
}

/**
 * Write content to file atomically
 *
 * Steps:
 * 1. Write to temp file (in same directory for rename atomicity)
 * 2. fsync to ensure content is on disk
 * 3. Rename temp to target (atomic on same filesystem)
 *
 * @param targetPath - Final destination path
 * @param content - Content to write
 * @param mode - File mode (default: 0o644)
 * @returns Result with success status
 */
export function atomicWriteSync(
  targetPath: string,
  content: string,
  mode: number = 0o644
): AtomicWriteResult {
  const dir = dirname(targetPath);
  const tempPath = join(dir, `.${Date.now()}.tmp`);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let fd: number | null = null;

  try {
    // Open temp file
    fd = openSync(tempPath, 'w', mode);

    // Write content
    writeSync(fd, content, 0, 'utf-8');

    // Force to disk
    fsyncSync(fd);

    // Close before rename
    closeSync(fd);
    fd = null;

    // Atomic rename
    renameSync(tempPath, targetPath);

    return { success: true, tempPath };
  } catch (err) {
    // Cleanup on failure
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      tempPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Async version of atomic write
 */
export async function atomicWrite(
  targetPath: string,
  content: string,
  mode: number = 0o644
): Promise<AtomicWriteResult> {
  // Use sync version for simplicity (rename must be sync anyway for atomicity)
  return atomicWriteSync(targetPath, content, mode);
}

export default {
  atomicWriteSync,
  atomicWrite,
};
