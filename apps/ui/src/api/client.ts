/**
 * API Client
 * Handles all API requests with auth support
 */

const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Fetch wrapper with auth handling
 */
export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // Send httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // Handle 401 - redirect to login
  if (res.status === 401) {
    localStorage.removeItem('authenticated');
    window.location.href = '/login';
    throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success || !json.data) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN_ERROR',
      json.error?.message || 'An error occurred',
      res.status
    );
  }

  return json.data;
}

/**
 * POST request helper
 */
export async function postApi<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function putApi<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
