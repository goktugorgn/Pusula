/**
 * Safe command execution with strict allowlist
 *
 * CRITICAL SECURITY:
 * - Only predefined commands can be executed
 * - Parameters are validated with regex patterns
 * - Uses spawn() with argv arrays (no shell interpolation)
 * - No user input is ever interpolated into command strings
 */

import { spawn } from 'node:child_process';
import { ValidationError, CommandError } from './errors.js';

// ============================================================================
// ALLOWED SERVICES & UNITS
// ============================================================================

/** Allowed services for systemctl commands */
export const ALLOWED_SERVICES = ['unbound', 'cloudflared', 'dnscrypt-proxy'] as const;
export type AllowedService = (typeof ALLOWED_SERVICES)[number];

/** Allowed units for journalctl */
export const ALLOWED_UNITS = ['unbound', 'unbound-ui', 'cloudflared', 'dnscrypt-proxy'] as const;
export type AllowedUnit = (typeof ALLOWED_UNITS)[number];

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

/** Parameter validation patterns */
export const VALIDATORS = {
  /**
   * DNS zone name (FQDN pattern)
   * Matches: example.com, sub.example.com, example.com., .
   */
  ZONE: /^\.?$|^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/,

  /**
   * Hostname pattern
   * Matches: ns1.example.com, localhost, my-server
   */
  HOSTNAME: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/,

  /**
   * Line count (1-9999)
   */
  LINES: /^\d{1,4}$/,

  /**
   * ISO timestamp
   * Matches: 2026-01-17, 2026-01-17T18:00:00, 2026-01-17T18:00:00Z
   */
  SINCE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/,

  /**
   * Safe file path (limited to /etc/unbound/)
   */
  FILE: /^\/etc\/unbound\/[a-zA-Z0-9._-]+\.conf$/,

  /**
   * DoH URL allowlist pattern (for future use)
   * Only allows known trusted DoH endpoints
   */
  DOH_URL: /^https:\/\/(cloudflare-dns\.com|dns\.google|dns\.quad9\.net)(\/dns-query)?$/,
} as const;

// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

interface CommandDef {
  cmd: string;
  args: string[];
  timeout?: number;
  /** If true, non-zero exit codes are allowed (returns as success with code) */
  allowNonZero?: boolean;
}

const ALLOWED_COMMANDS: Record<string, CommandDef> = {
  // -------------------------------------------------------------------------
  // unbound-control commands
  // -------------------------------------------------------------------------
  'unbound-status': {
    cmd: 'unbound-control',
    args: ['status'],
    timeout: 5000,
  },
  'unbound-stats': {
    cmd: 'unbound-control',
    args: ['stats_noreset'],
    timeout: 5000,
  },
  'unbound-reload': {
    cmd: 'unbound-control',
    args: ['reload'],
    timeout: 10000,
  },
  'unbound-flush-all': {
    cmd: 'unbound-control',
    args: ['flush_zone', '.'],
    timeout: 5000,
  },
  'unbound-flush-zone': {
    cmd: 'unbound-control',
    args: ['flush_zone', '$ZONE'],
    timeout: 5000,
  },
  'unbound-flush-request': {
    cmd: 'unbound-control',
    args: ['flush', '$HOSTNAME'],
    timeout: 5000,
  },
  'unbound-checkconf': {
    cmd: 'unbound-checkconf',
    args: [],
    timeout: 10000,
  },
  'unbound-checkconf-file': {
    cmd: 'unbound-checkconf',
    args: ['-f', '$FILE'],
    timeout: 10000,
  },

  // -------------------------------------------------------------------------
  // systemctl commands (restricted to allowed services)
  // -------------------------------------------------------------------------
  'systemctl-is-active': {
    cmd: 'systemctl',
    args: ['is-active', '$SERVICE'],
    timeout: 5000,
    allowNonZero: true, // is-active returns 3 for inactive
  },
  'systemctl-status': {
    cmd: 'systemctl',
    args: ['status', '$SERVICE', '--no-pager'],
    timeout: 5000,
    allowNonZero: true, // status returns non-zero for stopped services
  },
  'systemctl-reload': {
    cmd: 'systemctl',
    args: ['reload', '$SERVICE'],
    timeout: 15000,
  },
  'systemctl-restart': {
    cmd: 'systemctl',
    args: ['restart', '$SERVICE'],
    timeout: 30000,
  },

  // -------------------------------------------------------------------------
  // journalctl commands (read-only)
  // -------------------------------------------------------------------------
  'journalctl-read': {
    cmd: 'journalctl',
    args: ['-u', '$UNIT', '--no-pager', '-n', '$LINES', '-o', 'json'],
    timeout: 10000,
  },
  'journalctl-since': {
    cmd: 'journalctl',
    args: ['-u', '$UNIT', '--no-pager', '--since', '$SINCE', '-o', 'json'],
    timeout: 10000,
  },
};

// ============================================================================
// TYPES
// ============================================================================

/** Structured result from command execution */
export interface ExecResult {
  /** Exit code (0 = success) */
  code: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  durationMs: number;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a command ID is in the allowlist
 */
export function isAllowedCommand(commandId: string): boolean {
  return commandId in ALLOWED_COMMANDS;
}

/**
 * Get list of allowed command IDs
 */
export function getAllowedCommands(): string[] {
  return Object.keys(ALLOWED_COMMANDS);
}

/**
 * Validate a zone name
 */
export function isValidZone(zone: string): boolean {
  return VALIDATORS.ZONE.test(zone);
}

/**
 * Validate a hostname
 */
export function isValidHostname(hostname: string): boolean {
  return VALIDATORS.HOSTNAME.test(hostname);
}

/**
 * Validate a DoH URL
 */
export function isValidDohUrl(url: string): boolean {
  return VALIDATORS.DOH_URL.test(url);
}

/**
 * Validate a parameter value against its pattern
 * @throws ValidationError if invalid
 */
export function validateParam(name: string, value: string): void {
  switch (name) {
    case 'ZONE':
      if (!VALIDATORS.ZONE.test(value)) {
        throw new ValidationError(`Invalid zone format: ${value}`);
      }
      break;

    case 'HOSTNAME':
      if (!VALIDATORS.HOSTNAME.test(value)) {
        throw new ValidationError(`Invalid hostname format: ${value}`);
      }
      break;

    case 'SERVICE':
      if (!ALLOWED_SERVICES.includes(value as AllowedService)) {
        throw new ValidationError(
          `Service not allowed: ${value}. Allowed: ${ALLOWED_SERVICES.join(', ')}`
        );
      }
      break;

    case 'UNIT':
      if (!ALLOWED_UNITS.includes(value as AllowedUnit)) {
        throw new ValidationError(
          `Unit not allowed: ${value}. Allowed: ${ALLOWED_UNITS.join(', ')}`
        );
      }
      break;

    case 'LINES':
      if (!VALIDATORS.LINES.test(value)) {
        throw new ValidationError(`Invalid line count: ${value}`);
      }
      break;

    case 'SINCE':
      if (!VALIDATORS.SINCE.test(value)) {
        throw new ValidationError(`Invalid timestamp format: ${value}`);
      }
      break;

    case 'FILE':
      if (!VALIDATORS.FILE.test(value)) {
        throw new ValidationError(`Invalid or disallowed file path: ${value}`);
      }
      if (value.includes('..') || value.includes('//')) {
        throw new ValidationError('Path traversal detected');
      }
      break;

    case 'DOH_URL':
      if (!VALIDATORS.DOH_URL.test(value)) {
        throw new ValidationError(`Invalid or disallowed DoH URL: ${value}`);
      }
      break;

    default:
      throw new ValidationError(`Unknown parameter: ${name}`);
  }
}

/**
 * Execute an allowlisted command safely
 *
 * @param commandId - ID of the command to execute
 * @param params - Optional parameters to substitute
 * @returns Promise with structured result { code, stdout, stderr, durationMs }
 * @throws ValidationError if command not allowed or params invalid
 * @throws CommandError if execution fails
 */
export async function safeExec(
  commandId: string,
  params: Record<string, string> = {}
): Promise<ExecResult> {
  const startTime = Date.now();

  // Check allowlist
  const def = ALLOWED_COMMANDS[commandId];
  if (!def) {
    throw new ValidationError(`Command not allowed: ${commandId}`);
  }

  // Build args with validated substitutions
  const args = def.args.map((arg) => {
    if (arg.startsWith('$')) {
      const paramName = arg.slice(1);
      const value = params[paramName];
      if (value === undefined) {
        throw new ValidationError(`Missing required parameter: ${paramName}`);
      }
      validateParam(paramName, value);
      return value;
    }
    return arg;
  });

  // Execute using spawn (NO SHELL!)
  return new Promise((resolve, reject) => {
    const child = spawn(def.cmd, args, {
      shell: false,
      timeout: def.timeout || 10000,
      env: { ...process.env, LC_ALL: 'C' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(new CommandError(commandId, err.message));
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      const exitCode = code ?? 1;

      // Check if this command allows non-zero exit codes
      if (exitCode === 0 || def.allowNonZero) {
        resolve({
          code: exitCode,
          stdout,
          stderr,
          durationMs,
        });
      } else {
        reject(new CommandError(commandId, stderr || `Exit code: ${exitCode}`));
      }
    });
  });
}

/**
 * Execute command and return stdout only (throws on non-zero exit)
 * Convenience wrapper for simple use cases
 */
export async function safeExecStdout(
  commandId: string,
  params: Record<string, string> = {}
): Promise<string> {
  const result = await safeExec(commandId, params);
  if (result.code !== 0 && !ALLOWED_COMMANDS[commandId]?.allowNonZero) {
    throw new CommandError(commandId, result.stderr || `Exit code: ${result.code}`);
  }
  return result.stdout;
}

export default safeExec;
