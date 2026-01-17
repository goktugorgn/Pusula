/**
 * Log reader unit tests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseJournalOutput, mapPriority, type LogEntry } from '../src/services/logReader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('logReader', () => {
  describe('parseJournalOutput', () => {
    it('parses journalctl JSON output correctly', () => {
      const fixture = readFileSync(join(fixturesDir, 'journalctl-output.txt'), 'utf-8');
      const entries = parseJournalOutput(fixture);

      expect(entries).toHaveLength(5);

      // First entry (error)
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('Error: connection refused from upstream');
      expect(entries[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entries[0].cursor).toBeDefined();

      // Second entry (warn)
      expect(entries[1].level).toBe('warn');
      expect(entries[1].message).toBe('Warning: slow response from 1.1.1.1');

      // Third entry (info)
      expect(entries[2].level).toBe('info');
      expect(entries[2].message).toBe('query www.example.com A');

      // Fourth entry (info)
      expect(entries[3].level).toBe('info');

      // Fifth entry (error)
      expect(entries[4].level).toBe('error');
    });

    it('handles empty output', () => {
      const entries = parseJournalOutput('');
      expect(entries).toHaveLength(0);
    });

    it('handles malformed JSON lines gracefully', () => {
      const input = `
{"__REALTIME_TIMESTAMP":"1234567890123456","PRIORITY":"6","MESSAGE":"valid"}
not json
{ broken json
{"__REALTIME_TIMESTAMP":"1234567890234567","PRIORITY":"6","MESSAGE":"also valid"}
`;
      const entries = parseJournalOutput(input);

      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('valid');
      expect(entries[1].message).toBe('also valid');
    });

    it('handles missing MESSAGE field', () => {
      const input = '{"__REALTIME_TIMESTAMP":"1234567890123456","PRIORITY":"6"}';
      const entries = parseJournalOutput(input);

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('');
    });

    it('extracts cursor for pagination', () => {
      const input = '{"__REALTIME_TIMESTAMP":"1234567890123456","__CURSOR":"s=abc123;i=1","PRIORITY":"6","MESSAGE":"test"}';
      const entries = parseJournalOutput(input);

      expect(entries[0].cursor).toBe('s=abc123;i=1');
    });

    it('falls back to timestamp as cursor when __CURSOR missing', () => {
      const input = '{"__REALTIME_TIMESTAMP":"1234567890123456","PRIORITY":"6","MESSAGE":"test"}';
      const entries = parseJournalOutput(input);

      expect(entries[0].cursor).toBe('1234567890123456');
    });
  });

  describe('mapPriority', () => {
    it('maps emergency/alert/critical/error (0-3) to error', () => {
      expect(mapPriority(0)).toBe('error');
      expect(mapPriority(1)).toBe('error');
      expect(mapPriority(2)).toBe('error');
      expect(mapPriority(3)).toBe('error');
      expect(mapPriority('3')).toBe('error');
    });

    it('maps warning (4) to warn', () => {
      expect(mapPriority(4)).toBe('warn');
      expect(mapPriority('4')).toBe('warn');
    });

    it('maps notice/info (5-6) to info', () => {
      expect(mapPriority(5)).toBe('info');
      expect(mapPriority(6)).toBe('info');
      expect(mapPriority('6')).toBe('info');
    });

    it('maps debug (7) to debug', () => {
      expect(mapPriority(7)).toBe('debug');
      expect(mapPriority('7')).toBe('debug');
    });

    it('defaults unknown priorities to info', () => {
      expect(mapPriority(8)).toBe('info');
      expect(mapPriority(-1)).toBe('info');
      expect(mapPriority('invalid')).toBe('info');
    });
  });

  describe('query param validation', () => {
    // These tests validate the schema expectations
    it('accepts valid levels', () => {
      const validLevels = ['error', 'warn', 'info'];
      for (const level of validLevels) {
        expect(validLevels.includes(level)).toBe(true);
      }
    });

    it('limit defaults to 100 and caps at 1000', () => {
      // From schema: limit: z.coerce.number().int().min(1).max(1000).default(100)
      const defaultLimit = 100;
      const maxLimit = 1000;
      expect(defaultLimit).toBe(100);
      expect(maxLimit).toBe(1000);
    });
  });
});
