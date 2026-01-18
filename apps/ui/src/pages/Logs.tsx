/**
 * Logs Page - View Unbound logs
 */

import { useState } from 'react';
import { useUnboundLogs } from '../api';
import type { LogEntry } from '../api';

function LogRow({ entry }: { entry: LogEntry }) {
  const levelColors = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-blue-400',
    debug: 'text-gray-400',
  };

  return (
    <div className="flex gap-4 py-2 border-b border-white/5 text-sm font-mono">
      <span className="text-white/50 w-44 shrink-0">
        {new Date(entry.timestamp).toLocaleString()}
      </span>
      <span className={`w-12 shrink-0 ${levelColors[entry.level]}`}>
        {entry.level.toUpperCase()}
      </span>
      <span className="text-white/80 break-all">{entry.message}</span>
    </div>
  );
}

export default function LogsPage() {
  const [limit, setLimit] = useState(100);
  const { data, isLoading, refetch } = useUnboundLogs(limit);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Logs</h1>
        <div className="flex items-center gap-4">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="input w-auto"
          >
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={250}>250 entries</option>
            <option value={500}>500 entries</option>
          </select>
          <button
            onClick={() => refetch()}
            className="btn-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="glass p-4 overflow-x-auto">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-6 bg-white/10 rounded"></div>
            ))}
          </div>
        ) : data?.entries?.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            No log entries found
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data?.entries?.map((entry, i) => (
              <LogRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
