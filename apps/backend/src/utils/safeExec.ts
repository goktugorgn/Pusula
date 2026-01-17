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

// Allowed services for systemctl commands
const ALLOWED_SERVICES = ['unbound', 'cloudflared', 'dnscrypt-proxy'] as const;

// Allowed units for journalctl
const ALLOWED_UNITS = ['unbound', 'unbound-ui', 'cloudflared', 'dnscrypt-proxy'] as const;

// Parameter validation patterns
const VALIDATORS = {
  // DNS zone name (FQDN pattern)
  ZONE: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/,
  // Line count (1-9999)
  LINES: /^\d{1,4}$/,
  // ISO timestamp
  SINCE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/,
  // Safe file path (no traversal, limited directories)
  FILE: /^\/etc\/unbound\/[a-zA-Z0-9._-]+\.conf$/,
} as const;

// Command definitions
interface CommandDef {
  cmd: string;
  args: string[];
  timeout?: number;
}

const ALLOWED_COMMANDS: Record<string, CommandDef> = {
  // Unbound control
  'unbound-status': { cmd: 'unbound-control', args: ['status'], timeout: 5000 },
  'unbound-stats': { cmd: 'unbound-control', args: ['stats_noreset'], timeout: 5000 },
  'unbound-reload': { cmd: 'unbound-control', args: ['reload'], timeout: 10000 },
  'unbound-flush-all': { cmd: 'unbound-control', args: ['flush_zone', '.'], timeout: 5000 },
  'unbound-flush-zone': { cmd: 'unbound-control', args: ['flush_zone', '$ZONE'], timeout: 5000 },
  'unbound-checkconf': { cmd: 'unbound-checkconf', args: [], timeout: 10000 },
  'unbound-checkconf-file': { cmd: 'unbound-checkconf', args: ['-f', '$FILE'], timeout: 10000 },

  // Systemctl (restricted services)
  'systemctl-is-active': { cmd: 'systemctl', args: ['is-active', '$SERVICE'], timeout: 5000 },
  'systemctl-status': { cmd: 'systemctl', args: ['status', '$SERVICE', '--no-pager'], timeout: 5000 },
  'systemctl-reload': { cmd: 'systemctl', args: ['reload', '$SERVICE'], timeout: 15000 },
  'systemctl-restart': { cmd: 'systemctl', args: ['restart', '$SERVICE'], timeout: 30000 },

  // Journal reading (read-only)
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
 * Validate a parameter value against its pattern
 */
function validateParam(name: string, value: string): void {
  switch (name) {
    case 'ZONE':
      if (!VALIDATORS.ZONE.test(value)) {
        throw new ValidationError(`Invalid zone format: ${value}`);
      }
      break;

    case 'SERVICE':
      if (!ALLOWED_SERVICES.includes(value as typeof ALLOWED_SERVICES[number])) {
        throw new ValidationError(
          `Service not allowed: ${value}. Allowed: ${ALLOWED_SERVICES.join(', ')}`
        );
      }
      break;

    case 'UNIT':
      if (!ALLOWED_UNITS.includes(value as typeof ALLOWED_UNITS[number])) {
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
      // Check pattern
      if (!VALIDATORS.FILE.test(value)) {
        throw new ValidationError(`Invalid or disallowed file path: ${value}`);
      }
      // Check for path traversal
      if (value.includes('..') || value.includes('//')) {
        throw new ValidationError('Path traversal detected');
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
 * @returns Promise with stdout
 */
export async function safeExec(
  commandId: string,
  params: Record<string, string> = {}
): Promise<string> {
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

  // Execute using spawn (no shell!)
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
      if (code === 0) {
        resolve(stdout);
      } else {
        // Some commands return non-zero for expected states
        // e.g., systemctl is-active returns 3 for inactive
        if (commandId === 'systemctl-is-active') {
          resolve(stdout.trim());
        } else {
          reject(new CommandError(commandId, stderr || `Exit code: ${code}`));
        }
      }
    });
  });
}

export default safeExec;
