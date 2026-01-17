/**
 * API client with auth interceptors
 */

const API_BASE = '/api';

interface ApiError {
  code: string;
  message: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pusula_token', token);
    } else {
      localStorage.removeItem('pusula_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    return localStorage.getItem('pusula_token');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      const error = new Error(data.error?.message || 'Request failed');
      (error as any).code = data.error?.code || 'UNKNOWN';
      (error as any).status = response.status;
      throw error;
    }

    return data.data as T;
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ token: string; expiresIn: number }>(
      'POST',
      '/login',
      { username, password }
    );
    this.setToken(data.token);
    return data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<void>('POST', '/user/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async logout() {
    this.setToken(null);
    try {
      await this.request('POST', '/logout');
    } catch {
      // Ignore logout errors
    }
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; uptime: number; version: string }>(
      'GET',
      '/health'
    );
  }

  // Unbound
  async getUnboundStatus() {
    return this.request<{
      running: boolean;
      uptime: number;
      version: string;
      mode: 'recursive' | 'dot' | 'doh';
    }>('GET', '/unbound/status');
  }

  async getUnboundStats() {
    return this.request<{
      totalQueries: number;
      cacheHits: number;
      cacheMisses: number;
      cacheHitRatio: number;
      servfailCount: number;
      nxdomainCount: number;
      avgResponseTime: number;
    }>('GET', '/unbound/stats');
  }

  async getUnboundLogs(params?: { level?: string; since?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.level) query.set('level', params.level);
    if (params?.since) query.set('since', params.since);
    if (params?.limit) query.set('limit', String(params.limit));
    
    const queryStr = query.toString();
    return this.request<{
      entries: Array<{ timestamp: string; level: string; message: string }>;
      total: number;
    }>('GET', `/unbound/logs${queryStr ? `?${queryStr}` : ''}`);
  }

  async reloadUnbound() {
    return this.request<void>('POST', '/unbound/reload');
  }

  async restartUnbound() {
    return this.request<void>('POST', '/unbound/restart');
  }

  async flushCache(type: 'all' | 'zone' = 'all', zone?: string) {
    return this.request<void>('POST', '/unbound/flush', { type, zone });
  }

  // Upstream
  async getUpstream() {
    return this.request<{
      mode: 'recursive' | 'dot' | 'doh';
      upstreams: Array<{
        id: string;
        type: 'dot' | 'doh';
        address: string;
        name?: string;
        enabled: boolean;
        priority?: number;
      }>;
    }>('GET', '/upstream');
  }

  async updateUpstream(config: {
    mode: 'recursive' | 'dot' | 'doh';
    upstreams?: Array<{
      id?: string;
      type: 'dot' | 'doh';
      address: string;
      name?: string;
      enabled: boolean;
      priority?: number;
    }>;
  }) {
    return this.request<{
      applied: boolean;
      snapshotId: string;
      selfTestPassed: boolean;
    }>('PUT', '/upstream', config);
  }

  // Self-test
  async runSelfTest() {
    return this.request<{
      passed: boolean;
      steps: Array<{
        name: string;
        passed: boolean;
        duration: number;
        error?: string;
      }>;
      totalDuration: number;
    }>('POST', '/self-test');
  }

  // Alerts
  async getAlerts() {
    return this.request<{
      alerts: Array<{
        id: string;
        severity: 'critical' | 'warning' | 'info';
        type: string;
        message: string;
        timestamp: string;
      }>;
    }>('GET', '/alerts');
  }

  async acknowledgeAlert(alertId: string) {
    return this.request<void>('POST', '/alerts/ack', { alertId });
  }

  // Pi-hole
  async getPiholeSummary() {
    return this.request<{
      status: 'enabled' | 'disabled' | 'unknown';
      totalQueries: number;
      blockedQueries: number;
      blockPercentage: number;
      domainsOnBlocklist: number;
    }>('GET', '/pihole/summary');
  }
}

export const api = new ApiClient();
export default api;
