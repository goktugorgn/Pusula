/**
 * Alerts Page
 * 
 * - Poll alerts every 15s
 * - Show active/acknowledged alerts
 * - Acknowledge with confirmation
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '../api/client';
import type { Alert, AlertSeverity, AlertStatus } from '../api/types';
import { GlassCard, Button, Badge, useToast } from '../components/ui';

// ============================================================================
// Types
// ============================================================================

interface AlertsResponse {
  alerts: Alert[];
  activeCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

const severityConfig: Record<AlertSeverity, { icon: string; color: string; bg: string }> = {
  critical: { icon: '🔴', color: 'text-red-400', bg: 'bg-red-500/20' },
  warning: { icon: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  info: { icon: '🔵', color: 'text-blue-400', bg: 'bg-blue-500/20' },
};

const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'danger' },
  acknowledged: { label: 'Acknowledged', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Alert Card Component
// ============================================================================

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: () => void;
  acknowledging: boolean;
}

function AlertCard({ alert, onAcknowledge, acknowledging }: AlertCardProps) {
  const config = severityConfig[alert.severity];
  const status = statusConfig[alert.status];
  const isActive = alert.status === 'active';

  return (
    <GlassCard 
      padding="lg" 
      borderColor={isActive ? (alert.severity === 'critical' ? 'danger' : 'warning') : 'none'}
      className={!isActive ? 'opacity-60' : ''}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`text-2xl p-2 rounded-lg ${config.bg}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className={`font-semibold ${config.color}`}>{alert.title}</h3>
            <Badge size="sm" variant={status.color as 'danger' | 'warning' | 'success' | 'default'}>
              {status.label}
            </Badge>
            <Badge size="sm" variant="default">
              {alert.rule}
            </Badge>
          </div>

          <p className="text-white/70 text-sm mb-3">{alert.message}</p>

          {/* Timestamps */}
          <div className="flex flex-wrap gap-4 text-xs text-white/50">
            <span>Created: {formatTime(alert.createdAt)}</span>
            <span>Updated: {formatTime(alert.updatedAt)}</span>
            {alert.acknowledgedAt && (
              <span>
                Acked: {formatTime(alert.acknowledgedAt)}
                {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
              </span>
            )}
          </div>

          {/* Details */}
          {alert.details && Object.keys(alert.details).length > 0 && (
            <div className="mt-3 p-2 bg-black/20 rounded-lg">
              <pre className="text-xs text-white/60 font-mono">
                {JSON.stringify(alert.details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        {isActive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAcknowledge}
            loading={acknowledging}
          >
            Acknowledge
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Poll alerts
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getApi<AlertsResponse>('/alerts'),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  // Acknowledge mutation
  const ackMutation = useMutation({
    mutationFn: (alertId: string) => postApi<{ message: string }>('/alerts/ack', { alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      addToast('success', 'Alert acknowledged');
      setAcknowledgingId(null);
    },
    onError: () => {
      addToast('error', 'Failed to acknowledge alert');
      setAcknowledgingId(null);
    },
  });

  // Handle acknowledge
  const handleAcknowledge = useCallback((alertId: string) => {
    setAcknowledgingId(alertId);
    ackMutation.mutate(alertId);
  }, [ackMutation]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    if (filter === 'all') return data.alerts;
    return data.alerts.filter((a) => a.status === filter);
  }, [data?.alerts, filter]);

  // Count by status
  const counts = useMemo(() => {
    if (!data?.alerts) return { active: 0, acknowledged: 0, resolved: 0 };
    return {
      active: data.alerts.filter((a) => a.status === 'active').length,
      acknowledged: data.alerts.filter((a) => a.status === 'acknowledged').length,
      resolved: data.alerts.filter((a) => a.status === 'resolved').length,
    };
  }, [data?.alerts]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-white/60 text-sm">Monitor system alerts and notifications</p>
        </div>
        {counts.active > 0 && (
          <Badge variant="danger" dot pulse>
            {counts.active} Active Alert{counts.active !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'acknowledged', 'resolved'] as const).map((f) => {
          const count = f === 'all' 
            ? (data?.alerts?.length || 0)
            : counts[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${filter === f 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
                }
              `}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-xs">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <GlassCard padding="lg">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">
              {filter === 'active' ? '✅' : '📭'}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {filter === 'active' ? 'No Active Alerts' : 'No Alerts'}
            </h3>
            <p className="text-white/60">
              {filter === 'active' 
                ? 'All systems are operating normally.' 
                : 'No alerts match the current filter.'
              }
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={() => handleAcknowledge(alert.id)}
              acknowledging={acknowledgingId === alert.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
