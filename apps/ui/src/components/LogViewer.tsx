/**
 * LogViewer Component
 * 
 * Features:
 * - Level filter (info/warn/error)
 * - Since filter (time range)
 * - Follow mode with 2s polling
 * - Client-side text search
 * - Auto-scroll toggle
 * - Copy selected lines
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '../api/client';
import type { LogEntry } from '../api/types';
import { GlassCard, Button, Badge, Input, useToast } from './ui';

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug';
type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

interface LogViewerProps {
  compact?: boolean;
  maxHeight?: string;
  initialLevel?: LogLevel;
  initialRange?: TimeRange;
  showHeader?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeRangeMs(range: TimeRange): number {
  const ms = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return ms[range];
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const levelColors: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  debug: 'text-gray-400',
};

const levelBg: Record<string, string> = {
  error: 'bg-red-500/10',
  warn: 'bg-yellow-500/10',
  info: 'bg-blue-500/10',
  debug: 'bg-gray-500/10',
};

// ============================================================================
// Log Entry Row
// ============================================================================

interface LogRowProps {
  entry: LogEntry;
  selected: boolean;
  onSelect: () => void;
}

function LogRow({ entry, selected, onSelect }: LogRowProps) {
  return (
    <div
      className={`
        flex items-start gap-3 px-3 py-1.5 font-mono text-sm cursor-pointer
        transition-colors border-l-2
        ${selected ? 'bg-indigo-500/20 border-l-indigo-500' : 'border-l-transparent hover:bg-white/5'}
        ${levelBg[entry.level]}
      `}
      onClick={onSelect}
    >
      <span className="text-white/40 shrink-0 w-20">
        {formatTimestamp(entry.timestamp)}
      </span>
      <span className={`shrink-0 w-12 uppercase text-xs font-bold ${levelColors[entry.level]}`}>
        {entry.level}
      </span>
      <span className="text-white/80 break-all flex-1">
        {entry.message}
      </span>
    </div>
  );
}

// ============================================================================
// LogViewer Component
// ============================================================================

export function LogViewer({
  compact = false,
  maxHeight = '500px',
  initialLevel = 'all',
  initialRange = '1h',
  showHeader = true,
}: LogViewerProps) {
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [level, setLevel] = useState<LogLevel>(initialLevel);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialRange);
  const [searchQuery, setSearchQuery] = useState('');
  const [follow, setFollow] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState<string | undefined>();

  // Calculate since timestamp
  const since = useMemo(() => {
    const now = Date.now();
    return new Date(now - getTimeRangeMs(timeRange)).toISOString();
  }, [timeRange]);

  // Query for logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['unbound-logs', level, since, cursor],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (level !== 'all') params.set('level', level);
      if (cursor) params.set('cursor', cursor);
      
      return getApi<{ entries: LogEntry[]; cursor?: string }>(`/unbound/logs?${params}`);
    },
    refetchInterval: follow ? 2000 : false,
    staleTime: follow ? 1000 : 10000,
  });

  // Update cursor from response
  useEffect(() => {
    if (data?.cursor && follow) {
      setCursor(data.cursor);
    }
  }, [data?.cursor, follow]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [data?.entries, autoScroll]);

  // Filter logs client-side
  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    
    let entries = data.entries;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter((e) => 
        e.message.toLowerCase().includes(query) ||
        e.level.toLowerCase().includes(query)
      );
    }
    
    return entries;
  }, [data?.entries, searchQuery]);

  // Handlers
  const handleToggleSelect = useCallback((index: number) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleCopySelected = useCallback(() => {
    if (selectedLines.size === 0) {
      addToast('info', 'No lines selected. Click on log lines to select them.');
      return;
    }

    const lines = filteredEntries
      .filter((_, i) => selectedLines.has(i))
      .map((e) => `[${formatTimestamp(e.timestamp)}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      addToast('success', `Copied ${selectedLines.size} line(s) to clipboard`);
    }).catch(() => {
      addToast('error', 'Failed to copy to clipboard');
    });
  }, [selectedLines, filteredEntries, addToast]);

  const handleClearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const handleToggleFollow = useCallback(() => {
    setFollow((f) => !f);
    if (!follow) {
      setAutoScroll(true);
      setCursor(undefined);
    }
  }, [follow]);

  return (
    <GlassCard padding={compact ? 'sm' : 'lg'} className="flex flex-col">
      {/* Header */}
      {showHeader && (
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h3 className="text-white font-semibold">Logs</h3>
          
          {/* Level Filter */}
          <div className="flex items-center gap-1">
            {(['all', 'error', 'warn', 'info', 'debug'] as LogLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  level === l
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-2 py-1 text-sm rounded-lg bg-white/10 text-white border-none outline-none"
          >
            <option value="15m">Last 15m</option>
            <option value="1h">Last 1h</option>
            <option value="6h">Last 6h</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
          </select>

          <div className="flex-1" />

          {/* Follow Toggle */}
          <button
            onClick={handleToggleFollow}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              follow
                ? 'bg-green-500/20 text-green-400'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span className={follow ? 'animate-pulse' : ''}>●</span>
            {follow ? 'Following' : 'Follow'}
          </button>

          {/* Refresh */}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            🔄
          </Button>
        </div>
      )}

      {/* Search & Controls */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            autoScroll
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
          title="Auto-scroll to bottom"
        >
          ⬇️ Auto
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopySelected}
          disabled={selectedLines.size === 0}
        >
          📋 Copy ({selectedLines.size})
        </Button>

        {selectedLines.size > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearSelection}>
            ✕ Clear
          </Button>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-3 mb-2 text-xs text-white/50">
        <span>{filteredEntries.length} entries</span>
        {searchQuery && <Badge size="sm">Filtered</Badge>}
        {follow && <Badge size="sm" variant="success" dot pulse>Live</Badge>}
        {isLoading && <span className="animate-pulse">Loading...</span>}
      </div>

      {/* Log Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto rounded-xl bg-black/30 border border-white/10"
        style={{ maxHeight }}
      >
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/40">
            {isLoading ? 'Loading logs...' : 'No log entries found'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredEntries.map((entry, index) => (
              <LogRow
                key={`${entry.timestamp}-${index}`}
                entry={entry}
                selected={selectedLines.has(index)}
                onSelect={() => handleToggleSelect(index)}
              />
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default LogViewer;
