/**
 * LogViewer - Live log display with filters
 */

import { useState, useRef, useEffect } from 'react';
import { Filter, Play, Pause, ChevronDown } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  isLoading?: boolean;
  isFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
  onFilterChange?: (level: string | null) => void;
  currentFilter?: string | null;
}

const levelColors: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-blue-400',
  debug: 'text-slate-400',
};

const levelBg: Record<string, string> = {
  error: 'bg-red-500/10',
  warn: 'bg-amber-500/10',
  info: 'bg-blue-500/10',
  debug: 'bg-slate-500/10',
};

export function LogViewer({
  logs,
  isLoading = false,
  isFollowing = true,
  onFollowChange,
  onFilterChange,
  currentFilter,
}: LogViewerProps) {
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when following
  useEffect(() => {
    if (isFollowing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const filters = ['all', 'error', 'warn', 'info', 'debug'];

  return (
    <div className="glass-card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="font-medium text-slate-200">Live Logs</h3>
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-800/50 
                         border border-slate-700/50 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span className="capitalize">{currentFilter || 'All'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilters && (
              <div className="absolute top-full right-0 mt-1 z-10 glass rounded-lg overflow-hidden min-w-[120px]">
                {filters.map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      onFilterChange?.(level === 'all' ? null : level);
                      setShowFilters(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors
                              ${(currentFilter || 'all') === level ? 'bg-slate-700/50 text-blue-400' : 'text-slate-300'}`}
                  >
                    <span className="capitalize">{level}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Follow toggle */}
          <button
            onClick={() => onFollowChange?.(!isFollowing)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors
                       ${isFollowing 
                         ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                         : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'}`}
          >
            {isFollowing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto p-4 space-y-1 font-mono text-sm"
      >
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 bg-slate-800/50 rounded animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            No logs to display
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 px-2 py-1 rounded ${levelBg[log.level] || ''}`}
            >
              <span className="text-slate-500 text-xs shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`uppercase text-xs font-medium w-12 shrink-0 ${levelColors[log.level] || 'text-slate-400'}`}>
                {log.level}
              </span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LogViewer;
