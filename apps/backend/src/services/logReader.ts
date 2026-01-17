/**
 * Log Reader Service
 * Reads logs via journalctl
 */

import { safeExec } from '../utils/safeExec.js';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  unit?: string;
}

/**
 * Parse journalctl JSON output into log entries
 */
function parseJournalOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      entries.push({
        timestamp: new Date(parseInt(json.__REALTIME_TIMESTAMP) / 1000).toISOString(),
        level: mapPriority(json.PRIORITY),
        message: json.MESSAGE || '',
        unit: json._SYSTEMD_UNIT,
      });
    } catch {
      // Skip invalid JSON lines
    }
  }

  return entries;
}

/**
 * Map syslog priority to log level
 */
function mapPriority(priority: string | number): string {
  const p = typeof priority === 'string' ? parseInt(priority, 10) : priority;
  switch (p) {
    case 0:
    case 1:
    case 2:
    case 3:
      return 'error';
    case 4:
      return 'warn';
    case 5:
    case 6:
      return 'info';
    case 7:
      return 'debug';
    default:
      return 'info';
  }
}

/**
 * Get logs for a systemd unit
 */
export async function getLogs(
  unit: string,
  options: {
    limit?: number;
    since?: string;
    level?: string;
  } = {}
): Promise<LogEntry[]> {
  const { limit = 100, since } = options;

  let output: string;
  if (since) {
    output = await safeExec('journalctl-since', {
      UNIT: unit,
      SINCE: since,
    });
  } else {
    output = await safeExec('journalctl-read', {
      UNIT: unit,
      LINES: String(Math.min(limit, 1000)),
    });
  }

  let entries = parseJournalOutput(output);

  // Filter by level if specified
  if (options.level) {
    entries = entries.filter((e) => e.level === options.level);
  }

  // Limit results
  return entries.slice(-limit);
}

/**
 * Get Unbound logs
 */
export async function getUnboundLogs(options?: {
  limit?: number;
  since?: string;
  level?: string;
}): Promise<{ entries: LogEntry[]; total: number }> {
  const entries = await getLogs('unbound', options);
  return {
    entries,
    total: entries.length,
  };
}

/**
 * Get backend (unbound-ui) logs
 */
export async function getBackendLogs(options?: {
  limit?: number;
  since?: string;
  level?: string;
}): Promise<{ entries: LogEntry[]; total: number }> {
  const entries = await getLogs('unbound-ui', options);
  return {
    entries,
    total: entries.length,
  };
}

export default {
  getLogs,
  getUnboundLogs,
  getBackendLogs,
};
