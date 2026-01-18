/**
 * Dashboard Page
 */

import { useUnboundStatus, useUnboundStats, useAlerts, usePiholeSummary } from '../api';

function StatusCard() {
  const { data: status, isLoading, error } = useUnboundStatus();

  if (isLoading) {
    return (
      <div className="glass p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass p-6 border-red-500/50">
        <h3 className="text-white/80 text-sm mb-2">Unbound Status</h3>
        <div className="text-red-400">Unable to connect</div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <h3 className="text-white/80 text-sm mb-2">Unbound Status</h3>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${status?.running ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-white text-xl font-semibold">
          {status?.running ? 'Running' : 'Stopped'}
        </span>
      </div>
      {status?.running && (
        <div className="mt-3 text-white/60 text-sm">
          <p>Mode: <span className="text-white capitalize">{status.mode}</span></p>
          <p>Version: <span className="text-white">{status.version}</span></p>
        </div>
      )}
    </div>
  );
}

function StatsCard() {
  const { data: stats, isLoading } = useUnboundStats();

  if (isLoading) {
    return (
      <div className="glass p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <h3 className="text-white/80 text-sm mb-4">Statistics</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-bold text-white">
            {stats?.totalQueries?.toLocaleString() || 0}
          </div>
          <div className="text-white/60 text-sm">Total Queries</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">
            {stats?.cacheHitRatio?.toFixed(1) || 0}%
          </div>
          <div className="text-white/60 text-sm">Cache Hit Ratio</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">
            {stats?.servfailCount?.toLocaleString() || 0}
          </div>
          <div className="text-white/60 text-sm">SERVFAIL</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">
            {stats?.nxdomainCount?.toLocaleString() || 0}
          </div>
          <div className="text-white/60 text-sm">NXDOMAIN</div>
        </div>
      </div>
    </div>
  );
}

function AlertsCard() {
  const { data, isLoading } = useAlerts();

  if (isLoading) {
    return (
      <div className="glass p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  const activeCount = data?.activeCount || 0;

  return (
    <div className="glass p-6">
      <h3 className="text-white/80 text-sm mb-2">Active Alerts</h3>
      <div className="flex items-center gap-2">
        {activeCount > 0 ? (
          <>
            <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-xl font-semibold text-yellow-400">{activeCount}</span>
          </>
        ) : (
          <>
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xl font-semibold text-green-400">All Clear</span>
          </>
        )}
      </div>
    </div>
  );
}

function PiholeCard() {
  const { data, isLoading } = usePiholeSummary();

  if (isLoading) {
    return (
      <div className="glass p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="glass p-6 opacity-60">
        <h3 className="text-white/80 text-sm mb-2">Pi-hole</h3>
        <div className="text-white/50 text-sm">Not configured</div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <h3 className="text-white/80 text-sm mb-2">Pi-hole</h3>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-3 h-3 rounded-full ${data.status === 'enabled' ? 'bg-green-500' : 'bg-gray-500'}`} />
        <span className="text-white capitalize">{data.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-white font-semibold">{data.totalQueries?.toLocaleString()}</div>
          <div className="text-white/60">Queries</div>
        </div>
        <div>
          <div className="text-white font-semibold">{data.percentBlocked?.toFixed(1)}%</div>
          <div className="text-white/60">Blocked</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard />
        <StatsCard />
        <AlertsCard />
        <PiholeCard />
      </div>
    </div>
  );
}
