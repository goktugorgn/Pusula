/**
 * Settings Page
 * 
 * - Change password form
 * - Server bind/port info (read-only)
 * - Audit log viewer (placeholder)
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { postApi, getApi } from '../api/client';
import { GlassCard, Button, Input, Badge, useToast } from '../components/ui';

// ============================================================================
// Types
// ============================================================================

interface ServerInfo {
  bind: string;
  port: number;
  uptime: number;
  version: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============================================================================
// Password Form Component
// ============================================================================

function PasswordChangeForm() {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      postApi<{ message: string }>('/user/change-password', data),
    onSuccess: () => {
      addToast('success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to change password';
      addToast('error', message);
    },
  });

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain a lowercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain a number';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (confirmPassword !== newPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      mutation.mutate({ currentPassword, newPassword });
    }
  }, [validate, mutation, currentPassword, newPassword]);

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <Input
          type="password"
          label="Current Password"
          placeholder="Enter current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={errors.currentPassword}
          autoComplete="current-password"
        />

        <Input
          type="password"
          label="New Password"
          placeholder="Enter new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          hint="At least 8 characters with uppercase, lowercase, and number"
          autoComplete="new-password"
        />

        <Input
          type="password"
          label="Confirm New Password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Change Password
        </Button>
      </form>
    </GlassCard>
  );
}

// ============================================================================
// Server Info Component
// ============================================================================

function ServerInfoSection() {
  const { data: status } = useQuery({
    queryKey: ['unbound-status'],
    queryFn: () => getApi<ServerInfo>('/unbound/status'),
    staleTime: 30000,
  });

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <GlassCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Server Information</h2>
        <Badge size="sm" variant="info">Read-only</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-white/50 text-sm mb-1">Bind Address</div>
          <div className="text-white font-mono">{status?.bind || '127.0.0.1'}</div>
        </div>

        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-white/50 text-sm mb-1">Port</div>
          <div className="text-white font-mono">{status?.port || 53}</div>
        </div>

        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-white/50 text-sm mb-1">Version</div>
          <div className="text-white font-mono">{status?.version || 'Unknown'}</div>
        </div>

        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-white/50 text-sm mb-1">Uptime</div>
          <div className="text-white font-mono">
            {status?.uptime ? formatUptime(status.uptime) : '--'}
          </div>
        </div>
      </div>

      <p className="text-white/40 text-xs mt-4">
        ⓘ Changing bind address or port requires editing config.yaml and restarting the service.
      </p>
    </GlassCard>
  );
}

// ============================================================================
// Audit Log Section (Placeholder)
// ============================================================================

function AuditLogSection() {
  const { addToast } = useToast();

  // Placeholder - wire to /api/audit-log when available
  const mockLogs = [
    { timestamp: new Date().toISOString(), action: 'login', user: 'admin', ip: '192.168.1.100' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'config_change', user: 'admin', ip: '192.168.1.100' },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'restart', user: 'admin', ip: '192.168.1.100' },
  ];

  const handleExport = useCallback(() => {
    addToast('info', 'Audit log export coming soon');
  }, [addToast]);

  return (
    <GlassCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Audit Log</h2>
        <div className="flex gap-2">
          <Badge size="sm" variant="warning">Preview</Badge>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            📥 Export
          </Button>
        </div>
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5">
              <th className="text-left p-3 text-white/50 font-medium">Time</th>
              <th className="text-left p-3 text-white/50 font-medium">Action</th>
              <th className="text-left p-3 text-white/50 font-medium">User</th>
              <th className="text-left p-3 text-white/50 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {mockLogs.map((log, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="p-3 text-white/60 font-mono text-xs">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-3">
                  <Badge size="sm" variant="default">{log.action}</Badge>
                </td>
                <td className="p-3 text-white/70">{log.user}</td>
                <td className="p-3 text-white/60 font-mono text-xs">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-white/40 text-xs mt-4">
        ⓘ Full audit log integration coming soon. Logs are stored at /var/log/unbound-ui/audit.log
      </p>
    </GlassCard>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/60 text-sm">Configure application and account settings</p>
      </div>

      {/* Password Change */}
      <PasswordChangeForm />

      {/* Server Info */}
      <ServerInfoSection />

      {/* Audit Log */}
      <AuditLogSection />
    </div>
  );
}
