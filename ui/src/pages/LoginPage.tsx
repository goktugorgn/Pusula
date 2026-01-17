/**
 * Login page
 */

import { useState } from 'react';
import { Compass, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ActionButton } from '@/components';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      if (err.code === 'LOCKED_OUT') {
        setError('Account locked. Please try again later.');
      } else if (err.code === 'RATE_LIMITED') {
        setError('Too many attempts. Please wait a moment.');
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl 
                          bg-blue-600/20 border border-blue-500/30 mb-4">
            <Compass className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100">Pusula</h1>
          <p className="text-slate-500 mt-2">DNS Management Interface</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="glass-card space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Sign In</h2>
            <p className="text-sm text-slate-500">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 
                            rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="glass-input"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="glass-input"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <ActionButton
            type="submit"
            isLoading={isLoading}
            className="w-full"
          >
            Sign In
          </ActionButton>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Unbound DNS Management for Raspberry Pi
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
