/**
 * Settings Page - User settings and actions
 */

import { useState } from 'react';
import { useChangePassword, useReloadUnbound, useRestartUnbound, useFlushCache } from '../api';

export default function SettingsPage() {
  const changePassword = useChangePassword();
  const reloadUnbound = useReloadUnbound();
  const restartUnbound = useRestartUnbound();
  const flushCache = useFlushCache();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters');
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Change Password */}
        <div className="glass p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-2 rounded-lg text-sm">
                {passwordSuccess}
              </div>
            )}
            <div>
              <label className="block text-white/80 text-sm mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                minLength={12}
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="btn-primary w-full"
            >
              {changePassword.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Service Actions */}
        <div className="glass p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Service Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => reloadUnbound.mutate()}
              disabled={reloadUnbound.isPending}
              className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-left transition-colors flex items-center gap-3"
            >
              <span>🔄</span>
              <div>
                <div className="font-medium">Reload Configuration</div>
                <div className="text-white/60 text-sm">Apply config changes without restart</div>
              </div>
            </button>

            <button
              onClick={() => restartUnbound.mutate()}
              disabled={restartUnbound.isPending}
              className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-left transition-colors flex items-center gap-3"
            >
              <span>⚡</span>
              <div>
                <div className="font-medium">Restart Service</div>
                <div className="text-white/60 text-sm">Full service restart</div>
              </div>
            </button>

            <button
              onClick={() => flushCache.mutate(undefined)}
              disabled={flushCache.isPending}
              className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-left transition-colors flex items-center gap-3"
            >
              <span>🗑️</span>
              <div>
                <div className="font-medium">Flush DNS Cache</div>
                <div className="text-white/60 text-sm">Clear all cached records</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
