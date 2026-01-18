/**
 * Alerts Page - View and acknowledge alerts
 */

import { useAlerts, useAckAlert } from '../api';
import type { Alert } from '../api';

function AlertItem({ alert, onAck }: { alert: Alert; onAck: () => void }) {
  const severityColors = {
    critical: 'border-red-500 bg-red-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10',
    info: 'border-blue-500 bg-blue-500/10',
  };

  const severityIcons = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`glass p-4 border-l-4 ${severityColors[alert.severity]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <span className="text-2xl">{severityIcons[alert.severity]}</span>
          <div>
            <h3 className="text-white font-semibold">{alert.title}</h3>
            <p className="text-white/70 text-sm">{alert.message}</p>
            <p className="text-white/50 text-xs mt-1">
              {new Date(alert.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {alert.status === 'active' && (
          <button
            onClick={onAck}
            className="text-white/70 hover:text-white text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            Acknowledge
          </button>
        )}
        {alert.status === 'acknowledged' && (
          <span className="text-green-400/70 text-sm">
            ✓ Acked by {alert.acknowledgedBy}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { data, isLoading } = useAlerts();
  const ackAlert = useAckAlert();

  const handleAck = (alertId: string) => {
    ackAlert.mutate(alertId);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Alerts</h1>
        <div className="glass p-6 animate-pulse">
          <div className="h-6 bg-white/20 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  const alerts = data?.alerts || [];
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const resolvedAlerts = alerts.filter((a) => a.status !== 'active');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              activeAlerts.length > 0
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {activeAlerts.length} active
          </span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-white mb-2">All Clear</h2>
          <p className="text-white/70">No alerts at this time.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">
                Active ({activeAlerts.length})
              </h2>
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAck={() => handleAck(alert.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved Alerts */}
          {resolvedAlerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white/70 mb-4">
                History ({resolvedAlerts.length})
              </h2>
              <div className="space-y-3 opacity-60">
                {resolvedAlerts.slice(0, 10).map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAck={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
