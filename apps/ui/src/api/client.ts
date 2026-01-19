/**
 * API Client
 * 
 * Features:
 * - Base URL from VITE_API_BASE_URL (defaults to same-origin /api)
 * - Fetch wrapper with JSON parsing
 * - Authorization header when token exists
 * - Normalized error handling (401, 429, etc.)
 */

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'LOCKED_OUT'
  | 'SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  isAuthError: boolean;
  isRateLimited: boolean;
  isLockedOut: boolean;
  retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isAuthError = status === 401;
    this.isRateLimited = status === 429;
    this.isLockedOut = status === 423;
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Token storage strategy:
 * - Always persist to localStorage (LAN-only single-user homelab app)
 * - In-memory cache for performance
 *
 * Security context:
 * - Pusula is designed for LAN-only access (no internet exposure)
 * - Single admin user model means XSS risk is minimal
 * - User experience (staying logged in) is prioritized
 * - Token has 24h TTL from backend
 */

let inMemoryToken: string | null = null;

export const tokenStore = {
  get(): string | null {
    // Check in-memory cache first
    if (inMemoryToken) return inMemoryToken;

    // Rehydrate from localStorage
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      inMemoryToken = stored; // Cache it
    }
    return stored;
  },

  set(token: string, _persist = true): void {
    // Always persist for LAN-only single-user app
    inMemoryToken = token;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('authenticated', 'true');
  },

  clear(): void {
    inMemoryToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('authenticated');
    localStorage.removeItem('user');
  },

  isAuthenticated(): boolean {
    return !!this.get();
  },

  /** Check if we have a token (for conditional query enabling) */
  hasToken(): boolean {
    return !!this.get();
  },
};

// ============================================================================
// Fetch Wrapper
// ============================================================================

// Event for auth state changes (used by route guards)
export const authEvents = new EventTarget();

export function dispatchAuthChange(authenticated: boolean): void {
  authEvents.dispatchEvent(
    new CustomEvent('authchange', { detail: { authenticated } })
  );
}

/**
 * Main fetch wrapper with auth and error handling
 */
export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = tokenStore.get();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach auth header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include', // Also send httpOnly cookie
      ...options,
      headers,
    });
  } catch (err) {
    // Network error (offline, CORS, etc.)
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to connect to server. Please check your connection.',
      0
    );
  }

  // Parse response
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      'UNKNOWN_ERROR',
      'Invalid response from server',
      res.status
    );
  }

  // Handle HTTP errors
  if (!res.ok) {
    const retryAfter = res.headers.get('Retry-After');
    const code = mapStatusToCode(res.status, json.error?.code);
    const message = json.error?.message || getDefaultMessage(code);

    // Handle 401 - trigger logout
    if (res.status === 401) {
      tokenStore.clear();
      dispatchAuthChange(false);
    }

    throw new ApiError(
      code,
      message,
      res.status,
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }

  // Handle API-level errors
  if (!json.success) {
    throw new ApiError(
      (json.error?.code as ErrorCode) || 'UNKNOWN_ERROR',
      json.error?.message || 'An error occurred',
      res.status
    );
  }

  return json.data as T;
}

// ============================================================================
// Request Helpers
// ============================================================================

export async function getApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'GET' });
}

export async function postApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function putApi<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'DELETE' });
}

// ============================================================================
// Helpers
// ============================================================================

function mapStatusToCode(status: number, apiCode?: string): ErrorCode {
  if (apiCode && isValidErrorCode(apiCode)) {
    return apiCode as ErrorCode;
  }

  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 400:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 423:
      return 'LOCKED_OUT';
    case 503:
      return 'SERVICE_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}

function isValidErrorCode(code: string): boolean {
  const validCodes: ErrorCode[] = [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'LOCKED_OUT',
    'SERVICE_ERROR',
    'NETWORK_ERROR',
    'UNKNOWN_ERROR',
  ];
  return validCodes.includes(code as ErrorCode);
}

function getDefaultMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    UNAUTHORIZED: 'Please log in to continue',
    FORBIDDEN: 'You do not have permission for this action',
    NOT_FOUND: 'The requested resource was not found',
    VALIDATION_ERROR: 'Please check your input',
    RATE_LIMITED: 'Too many requests. Please wait and try again.',
    LOCKED_OUT: 'Account temporarily locked. Please try again later.',
    SERVICE_ERROR: 'Service temporarily unavailable',
    NETWORK_ERROR: 'Unable to connect to server',
    UNKNOWN_ERROR: 'An unexpected error occurred',
  };
  return messages[code];
}
