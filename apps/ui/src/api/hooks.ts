/**
 * React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, postApi, putApi } from './client';
import type {
  UnboundStatus,
  UnboundStats,
  LogEntry,
  UpstreamConfig,
  SelfTestResult,
  Alert,
  PiholeSummary,
  LoginResponse,
  ApplyResult,
} from './types';

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi<{ status: string; uptime: number }>('/health'),
    retry: 1,
    staleTime: 10_000,
  });
}

export function useUnboundStatus() {
  return useQuery({
    queryKey: ['unbound-status'],
    queryFn: () => fetchApi<UnboundStatus>('/unbound/status'),
    refetchInterval: 10_000,
  });
}

export function useUnboundStats() {
  return useQuery({
    queryKey: ['unbound-stats'],
    queryFn: () => fetchApi<UnboundStats>('/unbound/stats'),
    refetchInterval: 5_000,
  });
}

export function useUnboundLogs(limit = 100) {
  return useQuery({
    queryKey: ['unbound-logs', limit],
    queryFn: () =>
      fetchApi<{ entries: LogEntry[]; cursor?: string }>(`/unbound/logs?limit=${limit}`),
    refetchInterval: 10_000,
  });
}

export function useUpstreamConfig() {
  return useQuery({
    queryKey: ['upstream'],
    queryFn: () => fetchApi<UpstreamConfig>('/upstream'),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () =>
      fetchApi<{ alerts: Alert[]; activeCount: number; engineRunning: boolean }>('/alerts'),
    refetchInterval: 30_000,
  });
}

export function usePiholeSummary() {
  return useQuery({
    queryKey: ['pihole-summary'],
    queryFn: () => fetchApi<PiholeSummary>('/pihole/summary'),
    refetchInterval: 60_000,
    retry: false,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      postApi<LoginResponse>('/login', credentials),
    onSuccess: () => {
      localStorage.setItem('authenticated', 'true');
      queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      localStorage.removeItem('authenticated');
      queryClient.clear();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      postApi<{ message: string }>('/user/change-password', data),
  });
}

export function useUpdateUpstream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<UpstreamConfig>) =>
      putApi<ApplyResult>('/upstream', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upstream'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
    },
  });
}

export function useReloadUnbound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => postApi<{ message: string }>('/unbound/reload', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
    },
  });
}

export function useRestartUnbound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => postApi<{ message: string }>('/unbound/restart', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
    },
  });
}

export function useFlushCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (zone?: string) =>
      postApi<{ message: string }>('/unbound/flush', zone ? { zone } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unbound-stats'] });
    },
  });
}

export function useSelfTest() {
  return useMutation({
    mutationFn: () => postApi<SelfTestResult>('/self-test', {}),
  });
}

export function useAckAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) =>
      postApi<{ acknowledged: boolean; alert: Alert }>('/alerts/ack', { alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
