/**
 * API Types
 * Matches backend schemas from OpenAPI
 */

// Unbound
export interface UnboundStatus {
  running: boolean;
  uptime: number;
  version: string;
  mode: 'recursive' | 'dot' | 'doh';
}

export interface UnboundStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  servfailCount: number;
  nxdomainCount: number;
  prefetchCount: number;
  avgResponseTime?: number;
}

export interface LogEntry {
  timestamp: string;
  priority: number;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  unit: string;
}

// Upstream
export interface DotProvider {
  id: string;
  name?: string;
  address: string;
  port: number;
  sni?: string;
  enabled: boolean;
  priority?: number;
}

export interface DohProvider {
  id: string;
  name?: string;
  endpoint: string;
  enabled: boolean;
}

export interface UpstreamConfig {
  mode: 'recursive' | 'dot' | 'doh';
  dotProviders: DotProvider[];
  dohProviders: DohProvider[];
  activeOrder?: string[];
  dohProxy?: {
    type: 'cloudflared' | 'dnscrypt-proxy';
    localPort: number;
  };
}

// Self-Test
export type StepStatus = 'pass' | 'warn' | 'fail';

export interface TestStep {
  name: string;
  status: StepStatus;
  details: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface SelfTestResult {
  steps: TestStep[];
  summary: {
    status: StepStatus;
    recommendations: string[];
  };
  totalDurationMs: number;
}

// Alerts
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  rule: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Pi-hole
export interface PiholeSummary {
  configured: boolean;
  status?: 'enabled' | 'disabled' | 'unknown';
  totalQueries?: number;
  blockedQueries?: number;
  percentBlocked?: number;
  domainsBeingBlocked?: number;
  gravityLastUpdated?: string | null;
  guidance?: string;
}

// Auth
export interface LoginResponse {
  token: string;
  expiresIn: number;
}

// Apply Result
export interface ApplyResult {
  success: boolean;
  snapshotId: string;
  validationPassed: boolean;
  reloadPassed: boolean;
  selfTestPassed: boolean;
  rolledBack: boolean;
  error?: string;
}
