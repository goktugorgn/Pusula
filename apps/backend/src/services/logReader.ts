/**
 * Log Reader Service
 * Reads logs via journalctl with cursor pagination and follow mode
 */

import { safeExec } from '../utils/safeExec.js';

/** Structured log entry */
export interface LogEntry {
  /** ISO timestamp */
  ts: string;
  /** Log level: error, warn, info, debug */
  level: 'error' | 'warn' | 'info' | 'debug';
  /** Log message content */
  message: string;
  /** Cursor for pagination (journal cursor or timestamp) */
  cursor?: string;
}

/** Result from log query */
export interface LogResult {
  entries: LogEntry[];
  /** Cursor for next page (use as 'cursor' param) */
  nextCursor: string | null;
  /** Total entries returned */
  count: number;
  /** Whether there may be more entries */
  hasMore: boolean;
}

/** Log query options */
export interface LogQueryOptions {
  /** Max entries to return (default: 100) */
  limit?: number;
  /** Filter by level */
  level?: 'error' | 'warn' | 'info';
  /** ISO timestamp to start from */
  since?: string;
  /** Cursor from previous query for pagination */
  cursor?: string;
  /** Follow mode: only return entries newer than cursor */
  follow?: boolean;
}

/**
 * Parse journalctl JSON output into log entries
 * Exported for unit testing
 */
export function parseJournalOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      
      // Get timestamp from __REALTIME_TIMESTAMP (microseconds since epoch)
      const microTs = parseInt(json.__REALTIME_TIMESTAMP, 10);
      const ts = new Date(microTs / 1000).toISOString();
      
      // Create cursor from timestamp for pagination
      const cursor = json.__CURSOR || String(microTs);

      entries.push({
        ts,
        level: mapPriority(json.PRIORITY),
        message: json.MESSAGE || '',
        cursor,
      });
    } catch {
      // Skip invalid JSON lines
    }
  }

  return entries;
}

/**
 * Map syslog priority (0-7) to log level
 * Priority: 0=emerg, 1=alert, 2=crit, 3=err, 4=warning, 5=notice, 6=info, 7=debug
 */
export function mapPriority(priority: string | number): 'error' | 'warn' | 'info' | 'debug' {
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
  options: LogQueryOptions = {}
): Promise<LogResult> {
  const { limit = 100, since, cursor, follow = false } = options;
  const effectiveLimit = Math.min(limit, 1000);

  let result;
  
  // Determine the 'since' timestamp
  let effectiveSince: string | undefined;
  
  if (cursor && follow) {
    // Follow mode: use cursor as 'since' to get newer entries
    // Cursor is either a journal cursor or a microsecond timestamp
    // Convert to ISO for journalctl --since
    try {
      const microTs = parseInt(cursor, 10);
      if (!isNaN(microTs)) {
        // Add 1 microsecond to avoid returning the same entry
        effectiveSince = new Date((microTs + 1) / 1000).toISOString();
      }
    } catch {
      // If cursor parse fails, use as-is or default
      effectiveSince = since;
    }
  } else if (since) {
    effectiveSince = since;
  } else if (!cursor) {
    // Default: last 1 hour
    effectiveSince = new Date(Date.now() - 3600000).toISOString();
  }

  // Execute journalctl
  if (effectiveSince) {
    result = await safeExec('journalctl-since', {
      UNIT: unit,
      SINCE: effectiveSince,
    });
  } else {
    result = await safeExec('journalctl-read', {
      UNIT: unit,
      LINES: String(effectiveLimit),
    });
  }

  let entries = parseJournalOutput(result.stdout);

  // Filter by level if specified
  if (options.level) {
    const levelPriority = getLevelPriority(options.level);
    entries = entries.filter((e) => getLevelPriority(e.level) <= levelPriority);
  }

  // Sort by timestamp (oldest first for consistent pagination)
  entries.sort((a, b) => a.ts.localeCompare(b.ts));

  // Apply limit
  const hasMore = entries.length > effectiveLimit;
  if (hasMore) {
    entries = entries.slice(0, effectiveLimit);
  }

  // Get cursor for next page (last entry's cursor)
  const nextCursor = entries.length > 0 ? entries[entries.length - 1].cursor || null : null;

  return {
    entries,
    nextCursor,
    count: entries.length,
    hasMore,
  };
}

/**
 * Map level to priority for filtering (lower = more severe)
 */
function getLevelPriority(level: string): number {
  switch (level) {
    case 'error':
      return 3;
    case 'warn':
      return 4;
    case 'info':
      return 6;
    case 'debug':
      return 7;
    default:
      return 6;
  }
}

/**
 * Get Unbound logs
 */
export async function getUnboundLogs(options?: LogQueryOptions): Promise<LogResult> {
  return getLogs('unbound', options);
}

/**
 * Get backend (unbound-ui) logs
 */
export async function getBackendLogs(options?: LogQueryOptions): Promise<LogResult> {
  return getLogs('unbound-ui', options);
}

export default {
  parseJournalOutput,
  mapPriority,
  getLogs,
  getUnboundLogs,
  getBackendLogs,
};
