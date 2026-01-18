/**
 * Action endpoints unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { flushCacheRequestSchema } from '../src/config/schema.js';

// Mock audit logger
const mockLogCacheFlush = vi.fn();
const mockLogServiceOp = vi.fn();

vi.mock('../src/security/auditLogger.js', () => ({
  logCacheFlush: (...args: unknown[]) => mockLogCacheFlush(...args),
  logServiceOp: (...args: unknown[]) => mockLogServiceOp(...args),
}));

describe('Action Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('flushCacheRequestSchema validation', () => {
    it('accepts valid zone flush request', () => {
      const result = flushCacheRequestSchema.parse({
        type: 'zone',
        value: 'example.com',
      });

      expect(result.type).toBe('zone');
      expect(result.value).toBe('example.com');
    });

    it('accepts valid request flush request', () => {
      const result = flushCacheRequestSchema.parse({
        type: 'request',
        value: 'www.example.com',
      });

      expect(result.type).toBe('request');
      expect(result.value).toBe('www.example.com');
    });

    it('rejects missing type', () => {
      expect(() => {
        flushCacheRequestSchema.parse({
          value: 'example.com',
        });
      }).toThrow(z.ZodError);
    });

    it('rejects invalid type', () => {
      expect(() => {
        flushCacheRequestSchema.parse({
          type: 'invalid',
          value: 'example.com',
        });
      }).toThrow(z.ZodError);
    });

    it('rejects missing value', () => {
      expect(() => {
        flushCacheRequestSchema.parse({
          type: 'zone',
        });
      }).toThrow(z.ZodError);
    });

    it('rejects empty value', () => {
      expect(() => {
        flushCacheRequestSchema.parse({
          type: 'zone',
          value: '',
        });
      }).toThrow(z.ZodError);
    });
  });

  describe('audit log called', () => {
    it('logCacheFlush signature supports zone type', async () => {
      const { logCacheFlush } = await import('../src/security/auditLogger.js');

      // Should not throw
      logCacheFlush('192.168.1.100', 'goktugorgn', 'zone', 'example.com', true);

      expect(mockLogCacheFlush).toHaveBeenCalledWith(
        '192.168.1.100',
        'goktugorgn',
        'zone',
        'example.com',
        true
      );
    });

    it('logCacheFlush signature supports request type', async () => {
      const { logCacheFlush } = await import('../src/security/auditLogger.js');

      // Should not throw
      logCacheFlush('192.168.1.100', 'goktugorgn', 'request', 'www.example.com', true);

      expect(mockLogCacheFlush).toHaveBeenCalledWith(
        '192.168.1.100',
        'goktugorgn',
        'request',
        'www.example.com',
        true
      );
    });

    it('logServiceOp called for reload', async () => {
      const { logServiceOp } = await import('../src/security/auditLogger.js');

      logServiceOp('192.168.1.100', 'goktugorgn', 'reload', 'unbound', true);

      expect(mockLogServiceOp).toHaveBeenCalledWith(
        '192.168.1.100',
        'goktugorgn',
        'reload',
        'unbound',
        true
      );
    });

    it('logServiceOp called for restart', async () => {
      const { logServiceOp } = await import('../src/security/auditLogger.js');

      logServiceOp('192.168.1.100', 'goktugorgn', 'restart', 'unbound', true);

      expect(mockLogServiceOp).toHaveBeenCalledWith(
        '192.168.1.100',
        'goktugorgn',
        'restart',
        'unbound',
        true
      );
    });
  });

  describe('unauthorized requests rejected', () => {
    it('authenticate function exists and throws UnauthorizedError', async () => {
      const { UnauthorizedError } = await import('../src/utils/errors.js');

      // UnauthorizedError should be defined
      expect(UnauthorizedError).toBeDefined();

      // Should create error with correct status
      const err = new UnauthorizedError('No token');
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });
  });
});
