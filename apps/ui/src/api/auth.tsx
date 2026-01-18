/**
 * Auth Context
 * 
 * Provides authentication state and actions throughout the app.
 * Uses in-memory token with optional localStorage persistence.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { postApi, tokenStore, authEvents, dispatchAuthChange, ApiError } from './client';
import { useToast } from '../components/ui';

// ============================================================================
// Types
// ============================================================================

interface User {
  username: string;
}

interface LoginCredentials {
  username: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse {
  token: string;
  expiresIn: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  checkAuth: () => boolean;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Initialize from stored token
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!token;

  // Listen for auth events (e.g., 401 from API client)
  useEffect(() => {
    const handleAuthChange = (event: Event) => {
      const { authenticated } = (event as CustomEvent).detail;
      if (!authenticated) {
        setToken(null);
        setUser(null);
        addToast('warning', 'Session expired. Please log in again.');
        navigate('/login');
      }
    };

    authEvents.addEventListener('authchange', handleAuthChange);
    return () => authEvents.removeEventListener('authchange', handleAuthChange);
  }, [navigate, addToast]);

  // Login action
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);

      try {
        const response = await postApi<LoginResponse>('/login', {
          username: credentials.username,
          password: credentials.password,
        });

        // Store token
        tokenStore.set(response.token, credentials.remember);
        setToken(response.token);

        // Store user info
        const userInfo = { username: credentials.username };
        setUser(userInfo);
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('authenticated', 'true');

        // Notify auth change
        dispatchAuthChange(true);

        // Show success
        addToast('success', 'Welcome back!');

        // Navigate to dashboard
        navigate('/');
      } catch (err) {
        if (err instanceof ApiError) {
          // Show specific error messages
          if (err.isLockedOut) {
            addToast('error', `Account locked. Try again in ${err.retryAfter || 15} minutes.`);
          } else if (err.isRateLimited) {
            addToast('error', 'Too many attempts. Please wait before trying again.');
          } else {
            addToast('error', err.message);
          }
        } else {
          addToast('error', 'Login failed. Please try again.');
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, addToast]
  );

  // Logout action
  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
    localStorage.removeItem('user');
    dispatchAuthChange(false);
    addToast('info', 'You have been logged out.');
    navigate('/login');
  }, [navigate, addToast]);

  // Check if authenticated (for route guards)
  const checkAuth = useCallback(() => {
    return tokenStore.isAuthenticated();
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
