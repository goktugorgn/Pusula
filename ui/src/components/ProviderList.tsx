/**
 * ProviderList - Upstream provider management
 */

import { useState } from 'react';
import {
  GripVertical,
  Trash2,
  Plus,
  Shield,
  Cloud,
  Check,
  X,
} from 'lucide-react';

interface Provider {
  id: string;
  type: 'dot' | 'doh';
  address: string;
  name?: string;
  enabled: boolean;
  priority?: number;
}

interface ProviderListProps {
  providers: Provider[];
  onChange: (providers: Provider[]) => void;
  mode: 'dot' | 'doh';
}

const PRESETS: Record<string, Provider[]> = {
  dot: [
    { id: 'cf-dot', type: 'dot', address: '1.1.1.1:853', name: 'Cloudflare', enabled: false, priority: 1 },
    { id: 'cf-dot-2', type: 'dot', address: '1.0.0.1:853', name: 'Cloudflare Secondary', enabled: false, priority: 2 },
    { id: 'google-dot', type: 'dot', address: '8.8.8.8:853', name: 'Google', enabled: false, priority: 3 },
    { id: 'quad9-dot', type: 'dot', address: '9.9.9.9:853', name: 'Quad9', enabled: false, priority: 4 },
  ],
  doh: [
    { id: 'cf-doh', type: 'doh', address: 'https://cloudflare-dns.com/dns-query', name: 'Cloudflare', enabled: false, priority: 1 },
    { id: 'google-doh', type: 'doh', address: 'https://dns.google/dns-query', name: 'Google', enabled: false, priority: 2 },
    { id: 'quad9-doh', type: 'doh', address: 'https://dns.quad9.net/dns-query', name: 'Quad9', enabled: false, priority: 3 },
  ],
};

export function ProviderList({ providers, onChange, mode }: ProviderListProps) {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [customName, setCustomName] = useState('');

  const toggleProvider = (id: string) => {
    onChange(
      providers.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      )
    );
  };

  const removeProvider = (id: string) => {
    onChange(providers.filter((p) => p.id !== id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newProviders = [...providers];
    [newProviders[index - 1], newProviders[index]] = [newProviders[index], newProviders[index - 1]];
    onChange(newProviders);
  };

  const moveDown = (index: number) => {
    if (index === providers.length - 1) return;
    const newProviders = [...providers];
    [newProviders[index], newProviders[index + 1]] = [newProviders[index + 1], newProviders[index]];
    onChange(newProviders);
  };

  const addCustom = () => {
    if (!customAddress.trim()) return;

    const newProvider: Provider = {
      id: `custom-${Date.now()}`,
      type: mode,
      address: customAddress.trim(),
      name: customName.trim() || 'Custom',
      enabled: true,
      priority: providers.length + 1,
    };

    onChange([...providers, newProvider]);
    setCustomAddress('');
    setCustomName('');
    setShowAddCustom(false);
  };

  const addPreset = (preset: Provider) => {
    if (providers.some((p) => p.id === preset.id)) return;
    onChange([...providers, { ...preset, enabled: true, priority: providers.length + 1 }]);
  };

  const availablePresets = PRESETS[mode]?.filter(
    (preset) => !providers.some((p) => p.id === preset.id)
  ) || [];

  const Icon = mode === 'dot' ? Shield : Cloud;

  return (
    <div className="space-y-4">
      {/* Provider list */}
      <div className="space-y-2">
        {providers.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No providers configured. Add from presets or custom.
          </div>
        ) : (
          providers.map((provider, index) => (
            <div
              key={provider.id}
              className={`
                flex items-center gap-3 p-3 rounded-xl border transition-all
                ${provider.enabled
                  ? 'bg-slate-800/50 border-slate-600/50'
                  : 'bg-slate-900/50 border-slate-700/30 opacity-60'
                }
              `}
            >
              <GripVertical className="w-4 h-4 text-slate-500 cursor-move" />
              
              <Icon className={`w-5 h-5 ${provider.enabled ? 'text-blue-400' : 'text-slate-500'}`} />
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 truncate">
                  {provider.name || provider.address}
                </p>
                <p className="text-xs text-slate-500 truncate">{provider.address}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === providers.length - 1}
                  className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↓
                </button>
              </div>

              <button
                onClick={() => toggleProvider(provider.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  provider.enabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {provider.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>

              <button
                onClick={() => removeProvider(provider.id)}
                className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Preset buttons */}
      {availablePresets.length > 0 && (
        <div>
          <p className="text-sm text-slate-500 mb-2">Quick add presets:</p>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => addPreset(preset)}
                className="px-3 py-1.5 text-sm bg-slate-800/50 border border-slate-700/50 
                           rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom provider form */}
      {showAddCustom ? (
        <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 space-y-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name (optional)"
            className="glass-input"
          />
          <input
            type="text"
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            placeholder={mode === 'dot' ? '1.1.1.1:853' : 'https://dns.example.com/dns-query'}
            className="glass-input"
          />
          <div className="flex gap-2">
            <button onClick={addCustom} className="glass-button text-sm">
              Add Provider
            </button>
            <button
              onClick={() => setShowAddCustom(false)}
              className="glass-button-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddCustom(true)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add custom provider
        </button>
      )}
    </div>
  );
}

export default ProviderList;
