/**
 * Alerts page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import api from '@/api/client';
import { GlassCard, ActionButton } from '@/components';
import { useToast } from '@/hooks/useToast';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  timestamp: string;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20',
  },
};

export function AlertsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(),
    refetchInterval: 15000,
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId),
    onSuccess: () => {
      addToast('success', 'Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to acknowledge alert');
    },
  });

  const alerts = data?.alerts || [];

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Alerts</h1>
          <p className="text-slate-500">Active system alerts and notifications</p>
        </div>
        {alerts.length > 0 && (
          <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-medium rounded-full border border-red-500/30">
            {alerts.length} active
          </span>
        )}
      </div>

      {/* Alert list */}
      <GlassCard>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 
                            flex items-center justify-center">
              <Bell className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-slate-400 mb-2">No active alerts</p>
            <p className="text-sm text-slate-500">
              All systems are operating normally
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${config.bg} ${config.border}`}
                >
                  <div className={`p-2 rounded-lg ${config.badge}`}>
                    <Icon className={`w-5 h-5 ${config.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium uppercase ${config.text}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-500">{alert.type}</span>
                    </div>
                    <p className="text-slate-200">{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTime(alert.timestamp)}
                    </p>
                  </div>
                  <ActionButton
                    onClick={() => ackMutation.mutate(alert.id)}
                    variant="ghost"
                    size="sm"
                    isLoading={ackMutation.isPending}
                    icon={<Check className="w-4 h-4" />}
                  >
                    Acknowledge
                  </ActionButton>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Info */}
      <GlassCard>
        <h3 className="text-lg font-medium text-slate-200 mb-4">Alert Types</h3>
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-red-400">Critical:</strong>{' '}
            Unbound service down or major failures requiring immediate attention.
          </p>
          <p>
            <strong className="text-amber-400">Warning:</strong>{' '}
            High error rates, upstream connectivity issues, or performance degradation.
          </p>
          <p>
            <strong className="text-blue-400">Info:</strong>{' '}
            Low cache hit ratio or other non-critical observations.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

export default AlertsPage;
