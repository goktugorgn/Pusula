/**
 * Atomic write utility tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { atomicWriteSync, atomicWrite } from '../src/utils/atomicWrite.js';

describe('atomicWrite', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'atomic-write-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('atomicWriteSync', () => {
    it('writes content to file atomically', () => {
      const targetPath = join(testDir, 'test.txt');
      const content = 'Hello, atomic world!';

      const result = atomicWriteSync(targetPath, content);

      expect(result.success).toBe(true);
      expect(existsSync(targetPath)).toBe(true);
      expect(readFileSync(targetPath, 'utf-8')).toBe(content);
    });

    it('creates parent directories if needed', () => {
      const targetPath = join(testDir, 'nested', 'dir', 'test.txt');
      const content = 'Nested content';

      const result = atomicWriteSync(targetPath, content);

      expect(result.success).toBe(true);
      expect(readFileSync(targetPath, 'utf-8')).toBe(content);
    });

    it('overwrites existing file', () => {
      const targetPath = join(testDir, 'overwrite.txt');

      atomicWriteSync(targetPath, 'Original');
      const result = atomicWriteSync(targetPath, 'Updated');

      expect(result.success).toBe(true);
      expect(readFileSync(targetPath, 'utf-8')).toBe('Updated');
    });

    it('cleans up temp file on success', () => {
      const targetPath = join(testDir, 'cleanup.txt');

      atomicWriteSync(targetPath, 'Content');

      // Check no .tmp files remain
      const files = require('fs').readdirSync(testDir);
      const tmpFiles = files.filter((f: string) => f.endsWith('.tmp'));
      expect(tmpFiles.length).toBe(0);
    });

    it('handles unicode content', () => {
      const targetPath = join(testDir, 'unicode.txt');
      const content = '日本語 🎉 émoji';

      const result = atomicWriteSync(targetPath, content);

      expect(result.success).toBe(true);
      expect(readFileSync(targetPath, 'utf-8')).toBe(content);
    });

    it('handles large content', () => {
      const targetPath = join(testDir, 'large.txt');
      const content = 'x'.repeat(1024 * 1024); // 1MB

      const result = atomicWriteSync(targetPath, content);

      expect(result.success).toBe(true);
      expect(readFileSync(targetPath, 'utf-8').length).toBe(1024 * 1024);
    });
  });

  describe('atomicWrite (async)', () => {
    it('writes content atomically', async () => {
      const targetPath = join(testDir, 'async.txt');
      const content = 'Async content';

      const result = await atomicWrite(targetPath, content);

      expect(result.success).toBe(true);
      expect(readFileSync(targetPath, 'utf-8')).toBe(content);
    });
  });
});
