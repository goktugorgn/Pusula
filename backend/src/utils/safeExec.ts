/**
 * Safe command execution wrapper
 * 
 * CRITICAL SECURITY: Only allowlisted commands can be executed.
 * No user input is interpolated into shell commands.
 * Uses spawn with argv arrays, never exec().
 */

import { spawn } from 'child_process';
import { CommandError, ValidationError } from './errors.js';

// Validation patterns
const PATTERNS = {
  zone: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/,
  service: /^(unbound|cloudflared|dnscrypt-proxy)$/,
  unit: /^(unbound|unbound-ui|cloudflared|dnscrypt-proxy)$/,
  positiveInt: /^\d+$/,
  priority: /^[0-8]$/,
  since: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/,
};

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Allowlisted commands with their argument templates
 * 
 * Parameters use $PARAM syntax and are validated before substitution
 */
const ALLOWED_COMMANDS: Record<string, { cmd: string; args: string[]; validators?: Record<string, RegExp> }> = {
  // Unbound control commands
  'unbound-status': {
    cmd: 'unbound-control',
    args: ['status'],
  },
  'unbound-stats': {
    cmd: 'unbound-control',
    args: ['stats_noreset'],
  },
  'unbound-reload': {
    cmd: 'unbound-control',
    args: ['reload'],
  },
  'unbound-flush-zone': {
    cmd: 'unbound-control',
    args: ['flush_zone', '$ZONE'],
    validators: { ZONE: PATTERNS.zone },
  },
  'unbound-flush-all': {
    cmd: 'unbound-control',
    args: ['flush_zone', '.'],
  },
  'unbound-checkconf': {
    cmd: 'unbound-checkconf',
    args: [],
  },
  'unbound-checkconf-file': {
    cmd: 'unbound-checkconf',
    args: ['$FILE'],
    // FILE validation done separately via path allowlist
  },

  // Systemctl commands
  'systemctl-is-active': {
    cmd: 'systemctl',
    args: ['is-active', '$SERVICE'],
    validators: { SERVICE: PATTERNS.service },
  },
  'systemctl-status': {
    cmd: 'systemctl',
    args: ['status', '$SERVICE', '--no-pager'],
    validators: { SERVICE: PATTERNS.service },
  },
  'systemctl-reload': {
    cmd: 'systemctl',
    args: ['reload', '$SERVICE'],
    validators: { SERVICE: PATTERNS.service },
  },
  'systemctl-restart': {
    cmd: 'systemctl',
    args: ['restart', '$SERVICE'],
    validators: { SERVICE: PATTERNS.service },
  },

  // Journalctl commands (read-only logs)
  'journalctl-read': {
    cmd: 'journalctl',
    args: ['-u', '$UNIT', '--no-pager', '-n', '$LINES', '-o', 'json'],
    validators: { UNIT: PATTERNS.unit, LINES: PATTERNS.positiveInt },
  },
  'journalctl-since': {
    cmd: 'journalctl',
    args: ['-u', '$UNIT', '--no-pager', '--since', '$SINCE', '-o', 'json'],
    validators: { UNIT: PATTERNS.unit, SINCE: PATTERNS.since },
  },
  'journalctl-priority': {
    cmd: 'journalctl',
    args: ['-u', '$UNIT', '--no-pager', '-p', '$PRIORITY', '-n', '$LINES', '-o', 'json'],
    validators: { UNIT: PATTERNS.unit, PRIORITY: PATTERNS.priority, LINES: PATTERNS.positiveInt },
  },
};

/**
 * Allowed file paths for file-based commands
 */
const ALLOWED_PATHS = {
  unboundConfig: [
    '/etc/unbound/unbound.conf',
    '/etc/unbound/unbound-ui-managed.conf',
  ],
  configDir: '/etc/unbound/',
};

/**
 * Validate parameters against their patterns
 */
function validateParams(
  params: Record<string, string>,
  validators: Record<string, RegExp>
): void {
  for (const [key, pattern] of Object.entries(validators)) {
    const value = params[key];
    if (value === undefined) {
      throw new ValidationError(`Missing required parameter: ${key}`);
    }
    if (!pattern.test(value)) {
      throw new ValidationError(`Invalid parameter format: ${key}`);
    }
  }
}

/**
 * Validate file path is in allowed list
 */
function validateFilePath(filePath: string): void {
  const isAllowed = ALLOWED_PATHS.unboundConfig.includes(filePath) ||
    filePath.startsWith(ALLOWED_PATHS.configDir);
  
  if (!isAllowed) {
    throw new ValidationError(`File path not allowed: ${filePath}`);
  }

  // Prevent path traversal
  if (filePath.includes('..')) {
    throw new ValidationError('Path traversal not allowed');
  }
}

/**
 * Substitute parameters in argument array
 */
function substituteParams(args: string[], params: Record<string, string>): string[] {
  return args.map(arg => {
    if (arg.startsWith('$')) {
      const paramName = arg.slice(1);
      const value = params[paramName];
      if (value === undefined) {
        throw new ValidationError(`Missing parameter: ${paramName}`);
      }
      return value;
    }
    return arg;
  });
}

/**
 * Execute an allowlisted command
 * 
 * @param commandId - The ID of the command from ALLOWED_COMMANDS
 * @param params - Parameters to substitute into the command
 * @param timeout - Timeout in milliseconds (default 30s)
 * @returns Command output
 */
export async function safeExec(
  commandId: string,
  params: Record<string, string> = {},
  timeout = 30000
): Promise<CommandResult> {
  const command = ALLOWED_COMMANDS[commandId];
  
  if (!command) {
    throw new ValidationError(`Unknown command: ${commandId}`);
  }

  // Validate parameters
  if (command.validators) {
    validateParams(params, command.validators);
  }

  // Special handling for file paths
  if (params.FILE) {
    validateFilePath(params.FILE);
  }

  // Substitute parameters
  const args = substituteParams(command.args, params);

  return new Promise((resolve, reject) => {
    const proc = spawn(command.cmd, args, {
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new CommandError(commandId, err.message));
    });

    proc.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
      });
    });
  });
}

/**
 * Check if a command exists in the allowlist
 */
export function isAllowedCommand(commandId: string): boolean {
  return commandId in ALLOWED_COMMANDS;
}

/**
 * Get list of allowed command IDs (for debugging/documentation)
 */
export function getAllowedCommands(): string[] {
  return Object.keys(ALLOWED_COMMANDS);
}
