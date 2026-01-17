/**
 * Upstreams page
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Shield, Cloud, AlertTriangle, Check } from 'lucide-react';
import api from '@/api/client';
import { GlassCard, ProviderList, ActionButton, ConfirmModal } from '@/components';
import { useToast } from '@/hooks/useToast';

type Mode = 'recursive' | 'dot' | 'doh';

interface Provider {
  id: string;
  type: 'dot' | 'doh';
  address: string;
  name?: string;
  enabled: boolean;
  priority?: number;
}

export function UpstreamsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  
  const [mode, setMode] = useState<Mode>('recursive');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [runSelfTest, setRunSelfTest] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current config
  const { data: upstream, isLoading } = useQuery({
    queryKey: ['upstream'],
    queryFn: () => api.getUpstream(),
  });

  // Initialize from API
  useEffect(() => {
    if (upstream) {
      setMode(upstream.mode);
      setProviders(upstream.upstreams || []);
    }
  }, [upstream]);

  // Track changes
  useEffect(() => {
    if (!upstream) return;
    
    const modeChanged = mode !== upstream.mode;
    const providersChanged = JSON.stringify(providers) !== JSON.stringify(upstream.upstreams || []);
    setHasChanges(modeChanged || providersChanged);
  }, [mode, providers, upstream]);

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      return api.updateUpstream({
        mode,
        upstreams: mode !== 'recursive' ? providers : undefined,
      });
    },
    onSuccess: (data) => {
      addToast('success', `Configuration applied successfully${data.selfTestPassed ? ' ✓' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['upstream'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });
      setHasChanges(false);
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to apply configuration');
    },
  });

  const handleApply = () => {
    setShowConfirm(false);
    applyMutation.mutate();
  };

  const modeOptions = [
    { value: 'recursive', label: 'Recursive', icon: Globe, description: 'Direct root resolution' },
    { value: 'dot', label: 'DoT', icon: Shield, description: 'DNS over TLS' },
    { value: 'doh', label: 'DoH', icon: Cloud, description: 'DNS over HTTPS' },
  ] as const;

  // Calculate diff for preview
  const getDiff = () => {
    if (!upstream) return null;
    
    const changes: string[] = [];
    
    if (mode !== upstream.mode) {
      changes.push(`Mode: ${upstream.mode} → ${mode}`);
    }
    
    const oldEnabled = (upstream.upstreams || []).filter(p => p.enabled).map(p => p.name || p.address);
    const newEnabled = providers.filter(p => p.enabled).map(p => p.name || p.address);
    
    const added = newEnabled.filter(p => !oldEnabled.includes(p));
    const removed = oldEnabled.filter(p => !newEnabled.includes(p));
    
    if (added.length > 0) changes.push(`Add: ${added.join(', ')}`);
    if (removed.length > 0) changes.push(`Remove: ${removed.join(', ')}`);
    
    return changes;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-800/50 rounded w-48 animate-pulse" />
        <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Upstream Configuration</h1>
        <p className="text-slate-500">Configure DNS resolution mode and upstream servers</p>
      </div>

      {/* Mode selector */}
      <GlassCard>
        <h3 className="text-lg font-medium text-slate-200 mb-4">Resolution Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mode === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setMode(option.value)}
                className={`
                  p-4 rounded-xl border text-left transition-all
                  ${isActive
                    ? 'bg-blue-600/20 border-blue-500/50 shadow-glow'
                    : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-700/30'
                  }
                `}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={`font-medium ${isActive ? 'text-blue-400' : 'text-slate-200'}`}>
                    {option.label}
                  </span>
                  {isActive && <Check className="w-4 h-4 text-blue-400 ml-auto" />}
                </div>
                <p className="text-sm text-slate-500">{option.description}</p>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Provider list (only for DoT/DoH) */}
      {mode !== 'recursive' && (
        <GlassCard>
          <h3 className="text-lg font-medium text-slate-200 mb-4">
            {mode === 'dot' ? 'DoT Upstream Servers' : 'DoH Upstream Servers'}
          </h3>
          <ProviderList
            providers={providers.filter(p => p.type === mode)}
            onChange={(newProviders) => setProviders(newProviders)}
            mode={mode}
          />
        </GlassCard>
      )}

      {/* Apply section */}
      {hasChanges && (
        <GlassCard className="border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-400">Unsaved Changes</h3>
              <div className="mt-2 text-sm text-slate-400 space-y-1">
                {getDiff()?.map((change, i) => (
                  <p key={i}>• {change}</p>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={runSelfTest}
            onChange={(e) => setRunSelfTest(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
          />
          Run self-test after applying
        </label>

        <ActionButton
          onClick={() => setShowConfirm(true)}
          disabled={!hasChanges}
          isLoading={applyMutation.isPending}
        >
          Apply Changes
        </ActionButton>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApply}
        title="Apply Configuration Changes"
        message={
          <div className="space-y-3">
            <p>The following changes will be applied:</p>
            <ul className="text-sm space-y-1 text-slate-300">
              {getDiff()?.map((change, i) => (
                <li key={i}>• {change}</li>
              ))}
            </ul>
            {runSelfTest && (
              <p className="text-sm text-blue-400">
                A self-test will run after applying. Configuration will be rolled back if it fails.
              </p>
            )}
          </div>
        }
        confirmLabel="Apply"
        isLoading={applyMutation.isPending}
      />
    </div>
  );
}

export default UpstreamsPage;
