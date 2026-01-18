/**
 * Upstreams Page
 * 
 * - Mode selector (recursive/dot/doh)
 * - Provider management with presets
 * - Enable/disable + priority ordering
 * - Change diff + self-test option
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getApi, putApi } from '../api/client';
import type { UpstreamConfig, DotProvider, DohProvider, ApplyResult } from '../api/types';
import {
  GlassCard,
  Button,
  Badge,
  Input,
  useToast,
} from '../components/ui';

// ============================================================================
// Provider Presets
// ============================================================================

const DOT_PRESETS: Omit<DotProvider, 'id' | 'enabled'>[] = [
  { name: 'Cloudflare', address: '1.1.1.1', port: 853, sni: 'cloudflare-dns.com' },
  { name: 'Cloudflare Secondary', address: '1.0.0.1', port: 853, sni: 'cloudflare-dns.com' },
  { name: 'Quad9', address: '9.9.9.9', port: 853, sni: 'dns.quad9.net' },
  { name: 'Google', address: '8.8.8.8', port: 853, sni: 'dns.google' },
  { name: 'Google Secondary', address: '8.8.4.4', port: 853, sni: 'dns.google' },
];

const DOH_PRESETS: Omit<DohProvider, 'id' | 'enabled'>[] = [
  { name: 'Cloudflare', endpoint: 'https://cloudflare-dns.com/dns-query' },
  { name: 'Quad9', endpoint: 'https://dns.quad9.net/dns-query' },
  { name: 'Google', endpoint: 'https://dns.google/dns-query' },
];

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// Components
// ============================================================================

interface ModeCardProps {
  mode: 'recursive' | 'dot' | 'doh';
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ModeCard({ mode, selected, onSelect, disabled }: ModeCardProps) {
  const config = {
    recursive: { 
      icon: '🔄', 
      title: 'Recursive', 
      desc: 'Resolve directly from root servers' 
    },
    dot: { 
      icon: '🔒', 
      title: 'DoT (DNS-over-TLS)', 
      desc: 'Encrypted DNS with upstream providers' 
    },
    doh: { 
      icon: '🌐', 
      title: 'DoH (DNS-over-HTTPS)', 
      desc: 'DNS via HTTPS with upstream providers' 
    },
  };

  const { icon, title, desc } = config[mode];

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        p-4 rounded-xl text-left transition-all
        ${selected 
          ? 'bg-indigo-500/30 border-2 border-indigo-500 shadow-lg' 
          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-white font-semibold">{title}</div>
      <div className="text-white/50 text-sm">{desc}</div>
    </button>
  );
}

interface ProviderRowProps {
  provider: DotProvider | DohProvider;
  type: 'dot' | 'doh';
  index: number;
  total: number;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function ProviderRow({ 
  provider, 
  type, 
  index, 
  total, 
  onToggle, 
  onMoveUp, 
  onMoveDown, 
  onRemove 
}: ProviderRowProps) {
  const isDot = type === 'dot';
  const dotProvider = provider as DotProvider;
  const dohProvider = provider as DohProvider;

  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-xl transition-colors
      ${provider.enabled ? 'bg-white/10' : 'bg-white/5 opacity-60'}
    `}>
      {/* Priority */}
      <div className="flex flex-col gap-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-white/50 hover:text-white disabled:opacity-30 text-sm"
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-white/50 hover:text-white disabled:opacity-30 text-sm"
          title="Move down"
        >
          ▼
        </button>
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="text-white font-medium">
          {provider.name || (isDot ? dotProvider.address : 'DoH Provider')}
        </div>
        <div className="text-white/50 text-sm">
          {isDot 
            ? `${dotProvider.address}:${dotProvider.port}${dotProvider.sni ? ` (SNI: ${dotProvider.sni})` : ''}`
            : dohProvider.endpoint
          }
        </div>
      </div>

      {/* Priority Badge */}
      <Badge size="sm" variant={provider.enabled ? 'default' : 'warning'}>
        #{index + 1}
      </Badge>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`
          px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${provider.enabled 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-500/20 text-gray-400'
          }
        `}
      >
        {provider.enabled ? 'Enabled' : 'Disabled'}
      </button>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="text-white/40 hover:text-red-400 p-1 transition-colors"
        title="Remove provider"
      >
        ✕
      </button>
    </div>
  );
}

interface AddProviderFormProps {
  type: 'dot' | 'doh';
  onAdd: (provider: DotProvider | DohProvider) => void;
  onCancel: () => void;
}

function AddProviderForm({ type, onAdd, onCancel }: AddProviderFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState('853');
  const [sni, setSni] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');

    if (type === 'dot') {
      if (!address) {
        setError('Address is required');
        return;
      }
      if (!sni) {
        setError('SNI is required for DoT providers');
        return;
      }
      onAdd({
        id: generateId(),
        name: name || address,
        address,
        port: parseInt(port, 10) || 853,
        sni,
        enabled: true,
      });
    } else {
      if (!endpoint) {
        setError('Endpoint URL is required');
        return;
      }
      if (!endpoint.startsWith('https://')) {
        setError('Endpoint must be an HTTPS URL');
        return;
      }
      onAdd({
        id: generateId(),
        name: name || 'Custom DoH',
        endpoint,
        enabled: true,
      });
    }
  };

  return (
    <div className="bg-white/5 rounded-xl p-4 space-y-3">
      <div className="text-white font-medium">Add {type === 'dot' ? 'DoT' : 'DoH'} Provider</div>
      
      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      <Input
        label="Name (optional)"
        placeholder="e.g., My Provider"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {type === 'dot' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="IP Address"
              placeholder="e.g., 1.1.1.1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              label="Port"
              placeholder="853"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <Input
            label="SNI (required)"
            placeholder="e.g., cloudflare-dns.com"
            value={sni}
            onChange={(e) => setSni(e.target.value)}
            hint="Server Name Indication for TLS verification"
          />
        </>
      ) : (
        <Input
          label="Endpoint URL"
          placeholder="https://dns.example.com/dns-query"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          hint="Must be a valid HTTPS URL"
        />
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit}>
          Add Provider
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Change Diff Modal
// ============================================================================

interface ChangeDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (runSelfTest: boolean) => void;
  original: UpstreamConfig | undefined;
  modified: UpstreamConfig;
  loading?: boolean;
}

function ChangeDiffModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  original, 
  modified, 
  loading 
}: ChangeDiffModalProps) {
  const [runSelfTest, setRunSelfTest] = useState(true);

  const changes = useMemo(() => {
    const list: string[] = [];
    
    if (!original) {
      list.push('Initial configuration');
      return list;
    }

    if (original.mode !== modified.mode) {
      list.push(`Mode: ${original.mode} → ${modified.mode}`);
    }

    if (modified.mode === 'dot') {
      const origEnabled = original.dotProviders?.filter(p => p.enabled).length || 0;
      const modEnabled = modified.dotProviders?.filter(p => p.enabled).length || 0;
      if (origEnabled !== modEnabled) {
        list.push(`DoT providers enabled: ${origEnabled} → ${modEnabled}`);
      }
    }

    if (modified.mode === 'doh') {
      const origEnabled = original.dohProviders?.filter(p => p.enabled).length || 0;
      const modEnabled = modified.dohProviders?.filter(p => p.enabled).length || 0;
      if (origEnabled !== modEnabled) {
        list.push(`DoH providers enabled: ${origEnabled} → ${modEnabled}`);
      }
    }

    if (list.length === 0) {
      list.push('Provider ordering or settings changed');
    }

    return list;
  }, [original, modified]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-lg">
        <h2 className="text-xl font-bold text-white mb-4">Apply Changes</h2>
        
        <div className="mb-6">
          <div className="text-white/70 mb-3">The following changes will be applied:</div>
          <ul className="space-y-2">
            {changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-white">
                <span className="text-indigo-400">→</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={runSelfTest}
            onChange={(e) => setRunSelfTest(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-500"
          />
          <div>
            <div className="text-white font-medium">Run Self-test after apply</div>
            <div className="text-white/50 text-sm">Verify configuration works correctly</div>
          </div>
        </label>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-6">
          <div className="flex items-start gap-2 text-yellow-400 text-sm">
            <span>⚠️</span>
            <div>
              <strong>Important:</strong> A snapshot will be created before applying. 
              If the apply fails, configuration will be automatically rolled back.
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(runSelfTest)} loading={loading}>
            Apply Changes
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UpstreamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Load current config
  const { data: originalConfig, isLoading } = useQuery({
    queryKey: ['upstream'],
    queryFn: () => getApi<UpstreamConfig>('/upstream'),
  });

  // Local state for editing
  const [mode, setMode] = useState<'recursive' | 'dot' | 'doh'>('recursive');
  const [dotProviders, setDotProviders] = useState<DotProvider[]>([]);
  const [dohProviders, setDohProviders] = useState<DohProvider[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Initialize from loaded config
  useEffect(() => {
    if (originalConfig) {
      setMode(originalConfig.mode);
      setDotProviders(originalConfig.dotProviders || []);
      setDohProviders(originalConfig.dohProviders || []);
    }
  }, [originalConfig]);

  // Build modified config
  const modifiedConfig: UpstreamConfig = useMemo(() => ({
    mode,
    dotProviders,
    dohProviders,
  }), [mode, dotProviders, dohProviders]);

  // Check if there are changes
  const hasChanges = useMemo(() => {
    if (!originalConfig) return false;
    return !deepEqual(originalConfig, modifiedConfig);
  }, [originalConfig, modifiedConfig]);

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async (config: UpstreamConfig) => {
      return putApi<ApplyResult>('/upstream', config);
    },
    onSuccess: (result, _, context) => {
      queryClient.invalidateQueries({ queryKey: ['upstream'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-status'] });

      if (result.success) {
        addToast('success', 'Configuration applied successfully');
        if ((context as { runSelfTest?: boolean })?.runSelfTest) {
          navigate('/self-test');
        }
      } else if (result.rolledBack) {
        addToast('warning', 'Apply failed, rolled back to previous configuration');
      }

      setShowConfirmModal(false);
    },
    onError: (error) => {
      addToast('error', `Failed to apply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Handlers
  const handleAddPreset = useCallback((preset: typeof DOT_PRESETS[0] | typeof DOH_PRESETS[0], type: 'dot' | 'doh') => {
    if (type === 'dot') {
      const newProvider: DotProvider = {
        id: generateId(),
        enabled: true,
        ...(preset as typeof DOT_PRESETS[0]),
      };
      setDotProviders((prev) => [...prev, newProvider]);
    } else {
      const newProvider: DohProvider = {
        id: generateId(),
        enabled: true,
        ...(preset as typeof DOH_PRESETS[0]),
      };
      setDohProviders((prev) => [...prev, newProvider]);
    }
    addToast('info', `Added ${preset.name}`);
  }, [addToast]);

  const handleToggleProvider = useCallback((id: string, type: 'dot' | 'doh') => {
    if (type === 'dot') {
      setDotProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
      );
    } else {
      setDohProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
      );
    }
  }, []);

  const handleMoveProvider = useCallback((id: string, direction: 'up' | 'down', type: 'dot' | 'doh') => {
    const move = (arr: (DotProvider | DohProvider)[]) => {
      const idx = arr.findIndex((p) => p.id === id);
      if (idx === -1) return arr;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      const copy = [...arr];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    };

    if (type === 'dot') {
      setDotProviders((prev) => move(prev) as DotProvider[]);
    } else {
      setDohProviders((prev) => move(prev) as DohProvider[]);
    }
  }, []);

  const handleRemoveProvider = useCallback((id: string, type: 'dot' | 'doh') => {
    if (type === 'dot') {
      setDotProviders((prev) => prev.filter((p) => p.id !== id));
    } else {
      setDohProviders((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const handleAddCustomProvider = useCallback((provider: DotProvider | DohProvider) => {
    if ('address' in provider) {
      setDotProviders((prev) => [...prev, provider]);
    } else {
      setDohProviders((prev) => [...prev, provider as DohProvider]);
    }
    setShowAddForm(false);
    addToast('info', 'Custom provider added');
  }, [addToast]);

  const handleApply = useCallback((runSelfTest: boolean) => {
    applyMutation.mutate(modifiedConfig, {
      context: { runSelfTest },
    } as never);
  }, [applyMutation, modifiedConfig]);

  const handleReset = useCallback(() => {
    if (originalConfig) {
      setMode(originalConfig.mode);
      setDotProviders(originalConfig.dotProviders || []);
      setDohProviders(originalConfig.dohProviders || []);
      addToast('info', 'Changes reset');
    }
  }, [originalConfig, addToast]);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Upstream Configuration</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-white/10 rounded-xl" />
          <div className="h-48 bg-white/10 rounded-xl" />
        </div>
      </div>
    );
  }

  const currentProviders = mode === 'dot' ? dotProviders : dohProviders;
  const presets = mode === 'dot' ? DOT_PRESETS : DOH_PRESETS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Upstream Configuration</h1>
          <p className="text-white/60 text-sm">Configure DNS resolution mode and providers</p>
        </div>
        {hasChanges && (
          <Badge variant="warning" dot pulse>
            Unsaved Changes
          </Badge>
        )}
      </div>

      {/* Mode Selector */}
      <GlassCard padding="lg">
        <h2 className="text-lg font-semibold text-white mb-4">Resolution Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModeCard
            mode="recursive"
            selected={mode === 'recursive'}
            onSelect={() => setMode('recursive')}
          />
          <ModeCard
            mode="dot"
            selected={mode === 'dot'}
            onSelect={() => setMode('dot')}
          />
          <ModeCard
            mode="doh"
            selected={mode === 'doh'}
            onSelect={() => setMode('doh')}
          />
        </div>
      </GlassCard>

      {/* Providers (only for DoT/DoH) */}
      {mode !== 'recursive' && (
        <GlassCard padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {mode === 'dot' ? 'DoT Providers' : 'DoH Providers'}
            </h2>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowAddForm(true)}
            >
              + Add Custom
            </Button>
          </div>

          {/* Presets */}
          <div className="mb-4">
            <div className="text-white/50 text-sm mb-2">Quick add presets:</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const exists = mode === 'dot'
                  ? dotProviders.some((p) => p.address === (preset as typeof DOT_PRESETS[0]).address)
                  : dohProviders.some((p) => p.endpoint === (preset as typeof DOH_PRESETS[0]).endpoint);

                return (
                  <button
                    key={preset.name}
                    onClick={() => handleAddPreset(preset, mode)}
                    disabled={exists}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm transition-colors
                      ${exists
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-white/10 text-white hover:bg-white/20'
                      }
                    `}
                  >
                    {exists ? '✓ ' : '+ '}{preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-4">
              <AddProviderForm
                type={mode}
                onAdd={handleAddCustomProvider}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Provider List */}
          {currentProviders.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No providers configured. Add a preset or custom provider above.
            </div>
          ) : (
            <div className="space-y-2">
              {currentProviders.map((provider, index) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  type={mode}
                  index={index}
                  total={currentProviders.length}
                  onToggle={() => handleToggleProvider(provider.id, mode)}
                  onMoveUp={() => handleMoveProvider(provider.id, 'up', mode)}
                  onMoveDown={() => handleMoveProvider(provider.id, 'down', mode)}
                  onRemove={() => handleRemoveProvider(provider.id, mode)}
                />
              ))}
            </div>
          )}

          {mode === 'dot' && (
            <p className="text-white/40 text-xs mt-4">
              ℹ️ DoT providers require SNI for TLS verification. Providers are queried in priority order.
            </p>
          )}
          {mode === 'doh' && (
            <p className="text-white/40 text-xs mt-4">
              ℹ️ DoH requires cloudflared or dnscrypt-proxy to be configured. Endpoints must be HTTPS.
            </p>
          )}
        </GlassCard>
      )}

      {/* Recursive Mode Info */}
      {mode === 'recursive' && (
        <GlassCard padding="lg">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔄</div>
            <h3 className="text-lg font-semibold text-white mb-2">Recursive Mode</h3>
            <p className="text-white/60 max-w-md mx-auto">
              Unbound will resolve DNS queries directly from root servers. 
              No upstream providers are used, providing maximum privacy.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Actions */}
      <GlassCard padding="lg">
        <div className="flex items-center justify-between">
          <div className="text-white/50 text-sm">
            {hasChanges 
              ? 'You have unsaved changes.' 
              : 'Configuration matches current settings.'
            }
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </Button>
            <Button 
              onClick={() => setShowConfirmModal(true)}
              disabled={!hasChanges || (mode !== 'recursive' && currentProviders.filter(p => p.enabled).length === 0)}
            >
              Review & Apply
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Confirm Modal */}
      <ChangeDiffModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleApply}
        original={originalConfig}
        modified={modifiedConfig}
        loading={applyMutation.isPending}
      />
    </div>
  );
}
