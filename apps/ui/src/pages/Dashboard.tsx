/**
 * Dashboard Page
 * 
 * Live system overview with:
 * - Status/stats polling (3s)
 * - Alerts polling (15s)
 * - Mini charts for trends
 * - Quick actions with confirmations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '../api/client';
import type { UnboundStatus, UnboundStats, UpstreamConfig, Alert } from '../api/types';
import {
  GlassCard,
  StatCard,
  Button,
  Badge,
  ModeBadge,
  ConfirmModal,
  MiniChart,
  FlushModal,
  useToast,
} from '../components/ui';

// ============================================================================
// Data Polling Hooks
// ============================================================================

function useUnboundStatus() {
  return useQuery({
    queryKey: ['unbound-status'],
    queryFn: () => getApi<UnboundStatus>('/unbound/status'),
    refetchInterval: 3000,
    staleTime: 2000,
  });
}

function useUnboundStats() {
  return useQuery({
    queryKey: ['unbound-stats'],
    queryFn: () => getApi<UnboundStats>('/unbound/stats'),
    refetchInterval: 3000,
    staleTime: 2000,
  });
}

function useUpstreamConfig() {
  return useQuery({
    queryKey: ['upstream'],
    queryFn: () => getApi<UpstreamConfig>('/upstream'),
    staleTime: 30000,
  });
}

function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => getApi<{ alerts: Alert[]; activeCount: number }>('/alerts'),
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

// ============================================================================
// Action Hooks
// ============================================================================

function useReloadUnbound() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: () => postApi<{ message: string }>('/unbound/reload', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
      addToast('success', 'Configuration reloaded successfully');
    },
    onError: () => {
      addToast('error', 'Failed to reload configuration');
    },
  });
}

function useRestartUnbound() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: () => postApi<{ message: string }>('/unbound/restart', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
      addToast('success', 'Service restarted successfully');
    },
    onError: () => {
      addToast('error', 'Failed to restart service');
    },
  });
}

function useFlushCache() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (params?: { type: 'zone' | 'request'; value: string }) =>
      postApi<{ message: string }>('/unbound/flush', params ? { [params.type]: params.value } : {}),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
      const msg = params ? `Flushed ${params.type}: ${params.value}` : 'Cache flushed completely';
      addToast('success', msg);
    },
    onError: () => {
      addToast('error', 'Failed to flush cache');
    },
  });
}

// ============================================================================
// Stats History Hook (for charts)
// ============================================================================

const MAX_HISTORY = 20;

function useStatsHistory(stats: UnboundStats | undefined) {
  const [history, setHistory] = useState<{
    queries: number[];
    cacheHit: number[];
    timestamps: number[];
  }>({
    queries: [],
    cacheHit: [],
    timestamps: [],
  });

  const prevTotal = useRef<number>(0);

  useEffect(() => {
    if (!stats) return;

    const now = Date.now();
    const queryDelta = prevTotal.current > 0 
      ? Math.max(0, stats.totalQueries - prevTotal.current)
      : 0;
    prevTotal.current = stats.totalQueries;

    // Only add if we have a delta (skip first point)
    if (queryDelta >= 0 && history.timestamps.length > 0) {
      setHistory((h) => ({
        queries: [...h.queries.slice(-MAX_HISTORY + 1), queryDelta],
        cacheHit: [...h.cacheHit.slice(-MAX_HISTORY + 1), stats.cacheHitRatio],
        timestamps: [...h.timestamps.slice(-MAX_HISTORY + 1), now],
      }));
    } else if (history.timestamps.length === 0) {
      // Initialize with first point
      setHistory({
        queries: [0],
        cacheHit: [stats.cacheHitRatio],
        timestamps: [now],
      });
    }
  }, [stats?.totalQueries, stats?.cacheHitRatio]);

  return history;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ============================================================================
// Dashboard Component
// ============================================================================

export default function DashboardPage() {

  // Data queries
  const { data: status, isLoading: statusLoading } = useUnboundStatus();
  const { data: stats, isLoading: statsLoading } = useUnboundStats();
  const { data: upstream } = useUpstreamConfig();
  const { data: alertsData } = useAlerts();

  // Stats history for charts
  const statsHistory = useStatsHistory(stats);

  // Actions
  const reloadMutation = useReloadUnbound();
  const restartMutation = useRestartUnbound();
  const flushMutation = useFlushCache();

  // Modal states
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showFlushModal, setShowFlushModal] = useState(false);

  // Handlers
  const handleReload = useCallback(() => {
    reloadMutation.mutate();
    setShowReloadConfirm(false);
  }, [reloadMutation]);

  const handleRestart = useCallback(() => {
    restartMutation.mutate();
    setShowRestartConfirm(false);
  }, [restartMutation]);

  const handleFlush = useCallback(async (type: 'all' | 'zone' | 'request', value?: string) => {
    if (type === 'all') {
      flushMutation.mutate(undefined);
    } else if (value) {
      flushMutation.mutate({ type, value });
    }
  }, [flushMutation]);

  const isLoading = statusLoading || statsLoading;
  const activeAlerts = alertsData?.activeCount || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/60 text-sm">Real-time DNS resolver overview</p>
        </div>
        <div className="flex items-center gap-3">
          {upstream?.mode && <ModeBadge mode={upstream.mode} />}
          {activeAlerts > 0 && (
            <Badge variant="warning" dot pulse>
              {activeAlerts} Alert{activeAlerts !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Status"
          value={
            <span className={status?.running ? 'text-green-400' : 'text-red-400'}>
              {status?.running ? '● Running' : '○ Down'}
            </span>
          }
          icon="🖥️"
          loading={isLoading}
        />
        <StatCard
          label="Uptime"
          value={status?.uptime ? formatUptime(status.uptime) : '--'}
          icon="⏱️"
          loading={isLoading}
        />
        <StatCard
          label="Total Queries"
          value={formatNumber(stats?.totalQueries || 0)}
          icon="📊"
          loading={isLoading}
        />
        <StatCard
          label="Cache Hit"
          value={`${(stats?.cacheHitRatio || 0).toFixed(1)}%`}
          trend={stats?.cacheHitRatio && stats.cacheHitRatio > 80 ? 'up' : 'neutral'}
          icon="💾"
          loading={isLoading}
        />
        <StatCard
          label="SERVFAIL"
          value={formatNumber(stats?.servfailCount || 0)}
          trend={stats?.servfailCount && stats.servfailCount > 100 ? 'down' : 'neutral'}
          icon="⚠️"
          loading={isLoading}
        />
        <StatCard
          label="NXDOMAIN"
          value={formatNumber(stats?.nxdomainCount || 0)}
          icon="🚫"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Query Rate</h3>
            <span className="text-white/50 text-sm">queries/interval</span>
          </div>
          <MiniChart
            data={statsHistory.queries}
            width={400}
            height={80}
            color="#6366f1"
            valueFormatter={(v) => `${v.toFixed(0)} q/s`}
          />
        </GlassCard>

        <GlassCard padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Cache Hit Ratio</h3>
            <span className="text-white/50 text-sm">percentage</span>
          </div>
          <MiniChart
            data={statsHistory.cacheHit}
            width={400}
            height={80}
            color="#10b981"
            valueFormatter={(v) => `${v.toFixed(1)}%`}
          />
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <GlassCard padding="lg">
        <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            icon="🔄"
            onClick={() => setShowReloadConfirm(true)}
            disabled={reloadMutation.isPending || !status?.running}
            loading={reloadMutation.isPending}
          >
            Reload Config
          </Button>
          <Button
            variant="secondary"
            icon="⚡"
            onClick={() => setShowRestartConfirm(true)}
            disabled={restartMutation.isPending}
            loading={restartMutation.isPending}
          >
            Restart Service
          </Button>
          <Button
            variant="secondary"
            icon="🗑️"
            onClick={() => setShowFlushModal(true)}
            disabled={flushMutation.isPending || !status?.running}
            loading={flushMutation.isPending}
          >
            Flush Cache
          </Button>
        </div>
        <p className="text-white/40 text-xs mt-3">
          Actions require confirmation. Service must be running for Reload and Flush.
        </p>
      </GlassCard>

      {/* Upstream Health */}
      {upstream && (
        <GlassCard padding="lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Current Configuration</h3>
            <ModeBadge mode={upstream.mode} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-white/50">Mode:</span>
              <span className="text-white ml-2 capitalize">{upstream.mode}</span>
            </div>
            {upstream.mode === 'dot' && (
              <div>
                <span className="text-white/50">DoT Providers:</span>
                <span className="text-white ml-2">
                  {upstream.dotProviders?.filter(p => p.enabled).length || 0} active
                </span>
              </div>
            )}
            {upstream.mode === 'doh' && (
              <div>
                <span className="text-white/50">DoH Providers:</span>
                <span className="text-white ml-2">
                  {upstream.dohProviders?.filter(p => p.enabled).length || 0} active
                </span>
              </div>
            )}
            <div>
              <span className="text-white/50">Version:</span>
              <span className="text-white ml-2">{status?.version || 'Unknown'}</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={showReloadConfirm}
        onClose={() => setShowReloadConfirm(false)}
        onConfirm={handleReload}
        title="Reload Configuration"
        message="This will reload the Unbound configuration without restarting the service. Active connections will not be interrupted."
        confirmText="Reload"
        loading={reloadMutation.isPending}
      />

      <ConfirmModal
        isOpen={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestart}
        title="Restart Service"
        message="This will restart the Unbound DNS resolver. There will be a brief interruption in DNS resolution."
        confirmText="Restart"
        variant="danger"
        loading={restartMutation.isPending}
      />

      {/* Flush Modal */}
      <FlushModal
        isOpen={showFlushModal}
        onClose={() => setShowFlushModal(false)}
        onFlush={handleFlush}
        loading={flushMutation.isPending}
      />
    </div>
  );
}
