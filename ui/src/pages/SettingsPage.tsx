/**
 * Settings page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Key, Eye, EyeOff, Server, FileText } from 'lucide-react';
import api from '@/api/client';
import { GlassCard, ActionButton } from '@/components';
import { useToast } from '@/hooks/useToast';

export function SettingsPage() {
  const { addToast } = useToast();
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Health data for server info
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      addToast('error', 'Password must be at least 12 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      addToast('success', 'Password changed successfully. Please log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Logout will happen automatically since the token is invalidated
    } catch (err: any) {
      addToast('error', err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-500">Manage your account and view system information</p>
      </div>

      {/* Change password */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
            <Key className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-200">Change Password</h3>
            <p className="text-sm text-slate-500">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="glass-input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input pr-10"
                minLength={12}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Minimum 12 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input"
              required
            />
          </div>

          <ActionButton type="submit" isLoading={isChangingPassword}>
            Change Password
          </ActionButton>
        </form>
      </GlassCard>

      {/* Server info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
            <Server className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-200">Server Information</h3>
            <p className="text-sm text-slate-500">Backend service details</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">Version</span>
            <span className="text-slate-200">{health?.version || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">Uptime</span>
            <span className="text-slate-200">{health?.uptime ? `${Math.floor(health.uptime / 60)}m` : 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">Status</span>
            <span className="text-emerald-400">{health?.status || 'Unknown'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-400">API Base</span>
            <span className="text-slate-200">/api</span>
          </div>
        </div>
      </GlassCard>

      {/* Audit log info */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-200">Audit Log</h3>
            <p className="text-sm text-slate-500">Security event logging</p>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          All authentication attempts, configuration changes, and administrative actions are logged to{' '}
          <code className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">
            /var/log/unbound-ui/audit.log
          </code>
        </p>
      </GlassCard>
    </div>
  );
}

export default SettingsPage;
