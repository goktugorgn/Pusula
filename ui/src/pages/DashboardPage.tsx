/**
 * Dashboard page
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Database,
  AlertCircle,
  Clock,
  RefreshCw,
  Power,
  Trash2,
} from 'lucide-react';
import api from '@/api/client';
import {
  StatCard,
  MiniLineChart,
  LogViewer,
  ModeBadge,
  ConfirmModal,
  ActionButton,
  GlassCard,
} from '@/components';
import { useToast } from '@/hooks/useToast';

export function DashboardPage() {
  const { addToast } = useToast();
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'reload' | 'restart' | 'flush' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Track stats history for charts
  const queryHistory = useRef<number[]>([]);
  const cacheHistory = useRef<number[]>([]);

  // Status query
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['unbound-status'],
    queryFn: () => api.getUnboundStatus(),
    refetchInterval: 5000,
  });

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['unbound-stats'],
    queryFn: () => api.getUnboundStats(),
    refetchInterval: 3000,
  });

  // Logs query
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['unbound-logs', logFilter],
    queryFn: () => api.getUnboundLogs({ level: logFilter || undefined, limit: 50 }),
    refetchInterval: isFollowing ? 2000 : false,
  });

  // Update chart history
  useEffect(() => {
    if (stats) {
      queryHistory.current = [...queryHistory.current.slice(-19), stats.totalQueries || 0];
      cacheHistory.current = [...cacheHistory.current.slice(-19), stats.cacheHitRatio || 0];
    }
  }, [stats]);

  const handleAction = async (action: 'reload' | 'restart' | 'flush') => {
    setIsActionLoading(true);
    try {
      switch (action) {
        case 'reload':
          await api.reloadUnbound();
          addToast('success', 'Configuration reloaded successfully');
          break;
        case 'restart':
          await api.restartUnbound();
          addToast('success', 'Unbound service restarted');
          break;
        case 'flush':
          await api.flushCache('all');
          addToast('success', 'DNS cache flushed');
          break;
      }
    } catch (err: any) {
      addToast('error', err.message || 'Action failed');
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-500">Unbound DNS resolver status</p>
        </div>
        {status && <ModeBadge mode={status.mode} size="lg" />}
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Status"
          value={status?.running ? 'Running' : 'Down'}
          icon={<Activity className={`w-6 h-6 ${status?.running ? 'text-emerald-400' : 'text-red-400'}`} />}
          variant={status?.running ? 'success' : 'danger'}
          isLoading={statusLoading}
        />
        <StatCard
          title="Uptime"
          value={formatUptime(status?.uptime || 0)}
          subtitle={`v${status?.version || '?'}`}
          icon={<Clock className="w-6 h-6 text-blue-400" />}
          isLoading={statusLoading}
        />
        <StatCard
          title="Total Queries"
          value={stats?.totalQueries?.toLocaleString() || '0'}
          icon={<Database className="w-6 h-6 text-purple-400" />}
          isLoading={statsLoading}
        />
        <StatCard
          title="Cache Hit Ratio"
          value={`${stats?.cacheHitRatio?.toFixed(1) || '0'}%`}
          trend={stats && stats.cacheHitRatio > 50 ? 'up' : 'neutral'}
          icon={<Database className="w-6 h-6 text-cyan-400" />}
          isLoading={statsLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-sm font-medium text-slate-400 mb-4">Query Rate</h3>
          <MiniLineChart data={queryHistory.current} height={60} color="#3b82f6" />
        </GlassCard>
        <GlassCard>
          <h3 className="text-sm font-medium text-slate-400 mb-4">Cache Hit Ratio</h3>
          <MiniLineChart data={cacheHistory.current} height={60} color="#10b981" />
        </GlassCard>
      </div>

      {/* Error stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="SERVFAIL Responses"
          value={stats?.servfailCount?.toLocaleString() || '0'}
          icon={<AlertCircle className="w-6 h-6 text-red-400" />}
          variant={stats && stats.servfailCount > 100 ? 'warning' : 'default'}
          isLoading={statsLoading}
        />
        <StatCard
          title="NXDOMAIN Responses"
          value={stats?.nxdomainCount?.toLocaleString() || '0'}
          icon={<AlertCircle className="w-6 h-6 text-amber-400" />}
          isLoading={statsLoading}
        />
      </div>

      {/* Quick actions */}
      <GlassCard>
        <h3 className="text-lg font-medium text-slate-200 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            onClick={() => setConfirmAction('reload')}
            icon={<RefreshCw className="w-4 h-4" />}
            variant="secondary"
          >
            Reload Config
          </ActionButton>
          <ActionButton
            onClick={() => setConfirmAction('restart')}
            icon={<Power className="w-4 h-4" />}
            variant="secondary"
          >
            Restart Service
          </ActionButton>
          <ActionButton
            onClick={() => setConfirmAction('flush')}
            icon={<Trash2 className="w-4 h-4" />}
            variant="secondary"
          >
            Flush Cache
          </ActionButton>
        </div>
      </GlassCard>

      {/* Live logs */}
      <LogViewer
        logs={logsData?.entries || []}
        isLoading={logsLoading}
        isFollowing={isFollowing}
        onFollowChange={setIsFollowing}
        onFilterChange={setLogFilter}
        currentFilter={logFilter}
      />

      {/* Confirm modals */}
      <ConfirmModal
        isOpen={confirmAction === 'reload'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('reload')}
        title="Reload Configuration"
        message="This will reload Unbound configuration without restarting the service."
        confirmLabel="Reload"
        isLoading={isActionLoading}
      />
      <ConfirmModal
        isOpen={confirmAction === 'restart'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('restart')}
        title="Restart Unbound Service"
        message="This will restart the Unbound DNS service. There may be a brief interruption in DNS resolution."
        confirmLabel="Restart"
        variant="danger"
        isLoading={isActionLoading}
      />
      <ConfirmModal
        isOpen={confirmAction === 'flush'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('flush')}
        title="Flush DNS Cache"
        message="This will clear all cached DNS records. Resolution will be slower temporarily as the cache rebuilds."
        confirmLabel="Flush Cache"
        isLoading={isActionLoading}
      />
    </div>
  );
}

export default DashboardPage;
