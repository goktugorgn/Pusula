/**
 * Log reader service
 * 
 * Reads logs from journalctl with filtering and pagination
 */

import { safeExec } from '../utils/safeExec.js';

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  unit?: string;
}

interface JournalEntry {
  __REALTIME_TIMESTAMP?: string;
  PRIORITY?: string;
  MESSAGE?: string;
  _SYSTEMD_UNIT?: string;
}

/**
 * Map journald priority to log level
 */
function priorityToLevel(priority: string): LogEntry['level'] {
  const p = parseInt(priority, 10);
  if (p <= 3) return 'error';    // 0-3: emergency, alert, critical, error
  if (p === 4) return 'warn';    // 4: warning
  if (p <= 6) return 'info';     // 5-6: notice, info
  return 'debug';                 // 7: debug
}

/**
 * Map log level to journald priority
 */
function levelToPriority(level: LogEntry['level']): string {
  switch (level) {
    case 'error': return '3';
    case 'warn': return '4';
    case 'info': return '6';
    case 'debug': return '7';
    default: return '6';
  }
}

/**
 * Parse journalctl JSON output
 */
function parseJournalOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    if (!line) continue;

    try {
      const entry: JournalEntry = JSON.parse(line);
      
      // Convert microseconds to ISO timestamp
      const timestamp = entry.__REALTIME_TIMESTAMP
        ? new Date(parseInt(entry.__REALTIME_TIMESTAMP, 10) / 1000).toISOString()
        : new Date().toISOString();

      entries.push({
        timestamp,
        level: priorityToLevel(entry.PRIORITY || '6'),
        message: entry.MESSAGE || '',
        unit: entry._SYSTEMD_UNIT,
      });
    } catch {
      // Skip malformed JSON lines
    }
  }

  return entries;
}

/**
 * Get Unbound logs
 */
export async function getUnboundLogs(options: {
  limit?: number;
  level?: LogEntry['level'];
  since?: string;
}): Promise<LogEntry[]> {
  const { limit = 100, level, since } = options;

  let result;

  if (since) {
    result = await safeExec('journalctl-since', {
      UNIT: 'unbound',
      SINCE: since,
    });
  } else if (level) {
    result = await safeExec('journalctl-priority', {
      UNIT: 'unbound',
      PRIORITY: levelToPriority(level),
      LINES: String(Math.min(limit, 1000)),
    });
  } else {
    result = await safeExec('journalctl-read', {
      UNIT: 'unbound',
      LINES: String(Math.min(limit, 1000)),
    });
  }

  const entries = parseJournalOutput(result.stdout);

  // Filter by level if specified and not using priority filter
  if (level && !since) {
    return entries.slice(0, limit);
  }

  return entries.slice(0, limit);
}

/**
 * Get backend service logs
 */
export async function getBackendLogs(options: {
  limit?: number;
}): Promise<LogEntry[]> {
  const { limit = 100 } = options;

  const result = await safeExec('journalctl-read', {
    UNIT: 'unbound-ui',
    LINES: String(Math.min(limit, 1000)),
  });

  return parseJournalOutput(result.stdout).slice(0, limit);
}

/**
 * Get combined logs from multiple units
 */
export async function getCombinedLogs(
  units: string[],
  limit: number = 100
): Promise<LogEntry[]> {
  const allEntries: LogEntry[] = [];

  for (const unit of units) {
    try {
      const result = await safeExec('journalctl-read', {
        UNIT: unit,
        LINES: String(Math.ceil(limit / units.length)),
      });

      allEntries.push(...parseJournalOutput(result.stdout));
    } catch {
      // Skip units that fail
    }
  }

  // Sort by timestamp and limit
  return allEntries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
