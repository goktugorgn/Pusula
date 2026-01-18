/**
 * Login Page
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../api/auth';
import { ApiError } from '../api/client';
import { GlassCard, Input, PasswordInput, Button } from '../components/ui';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  // Get redirect destination from route state
  const from = (location.state as { from?: Location })?.from?.pathname || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login({ username, password, remember });
      // Navigation handled by auth context
    } catch (err) {
      // Toast handled by auth context, but also show inline error
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pusula</h1>
          <p className="text-white/70">DNS Management Interface</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div 
              className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
            autoComplete="username"
            autoFocus
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            autoComplete="current-password"
          />

          <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-500"
            />
            Remember me
          </label>

          <Button
            type="submit"
            loading={isLoading}
            className="w-full"
            size="lg"
          >
            Sign In
          </Button>
        </form>

        {from !== '/' && (
          <p className="mt-4 text-center text-white/50 text-sm">
            You'll be redirected to your destination after login.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
