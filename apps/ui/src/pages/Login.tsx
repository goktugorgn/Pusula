/**
 * Login Page
 * 
 * Design Decision: Username is fixed to 'admin' (displayed but not editable).
 * This matches the single-user design of the Pusula system where only the admin
 * user can authenticate. The username field is shown for clarity but disabled.
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../api/auth';
import { ApiError } from '../api/client';
import { GlassCard, Button, Badge } from '../components/ui';

// Fixed admin username
const ADMIN_USERNAME = 'admin';

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'error' | 'lockout' | 'ratelimit'>('error');
  const [, setRetryAfter] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Get redirect destination from route state
  const from = (location.state as { from?: Location })?.from?.pathname || '/';

  // Countdown timer for lockout/rate limit
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setError('');
          setErrorType('error');
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown > 0]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorType('error');
    setRetryAfter(null);

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      await login({ username: ADMIN_USERNAME, password, remember: true });
      // Navigation handled by auth context
    } catch (err) {
      if (err instanceof ApiError) {
        // Handle lockout (423)
        if (err.isLockedOut) {
          setErrorType('lockout');
          setError('Account temporarily locked due to too many failed attempts.');
          if (err.retryAfter) {
            setRetryAfter(err.retryAfter);
            setCountdown(err.retryAfter * 60); // Convert minutes to seconds
          } else {
            setCountdown(15 * 60); // Default 15 minutes
          }
        }
        // Handle rate limit (429)
        else if (err.isRateLimited) {
          setErrorType('ratelimit');
          setError('Too many login attempts. Please wait before trying again.');
          if (err.retryAfter) {
            setRetryAfter(err.retryAfter);
            setCountdown(err.retryAfter);
          } else {
            setCountdown(60); // Default 1 minute
          }
        }
        // Other errors
        else {
          setErrorType('error');
          setError(err.message || 'Invalid credentials. Please try again.');
        }
      } else {
        setErrorType('error');
        setError('Login failed. Please try again.');
      }
    }
  };

  const isLocked = errorType === 'lockout' || errorType === 'ratelimit';
  const canSubmit = !isLoading && !isLocked && password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      <GlassCard variant="elevated" padding="lg" className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30 mb-4">
            <span className="text-3xl">🧭</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Pusula</h1>
          <p className="text-white/60">DNS Management Interface</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div 
              className={`px-4 py-3 rounded-xl text-sm flex items-start gap-3 ${
                errorType === 'lockout'
                  ? 'bg-red-500/20 border border-red-500/50 text-red-200'
                  : errorType === 'ratelimit'
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200'
                    : 'bg-red-500/20 border border-red-500/50 text-red-200'
              }`}
              role="alert"
            >
              <span className="text-lg mt-0.5">
                {errorType === 'lockout' ? '🔒' : errorType === 'ratelimit' ? '⏱️' : '⚠️'}
              </span>
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {countdown > 0 && (
                  <p className="mt-1 opacity-80">
                    Try again in: <span className="font-mono font-bold">{formatTime(countdown)}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Username Field (Fixed) */}
          <div>
            <label className="block text-white/80 text-sm font-medium mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={ADMIN_USERNAME}
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-white/50 text-gray-700 border-2 border-transparent cursor-not-allowed"
                aria-label="Username (fixed)"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2"><Badge size="sm" variant="info">
                Admin
              </Badge></span>
            </div>
            <p className="mt-1 text-white/40 text-xs">
              Single-user admin account
            </p>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-white/80 text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked}
                className={`
                  w-full px-4 py-2.5 pr-12 rounded-xl
                  bg-white/90 text-gray-900 placeholder-gray-500
                  border-2 transition-all duration-200
                  ${isLocked 
                    ? 'opacity-50 cursor-not-allowed border-transparent' 
                    : 'border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                  }
                  outline-none
                `}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            loading={isLoading}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            {isLocked ? (
              <>🔒 Locked</>
            ) : isLoading ? (
              <>Signing in...</>
            ) : (
              <>Sign In</>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-white/40 text-xs">
            Secure DNS management for Raspberry Pi
          </p>
        </div>

        {from !== '/' && (
          <p className="mt-4 text-center text-white/50 text-sm">
            You'll be redirected after login.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
