/**
 * Upstreams Page - Configure DNS upstream providers
 */

import { useUpstreamConfig, useUpdateUpstream } from '../api';

export default function UpstreamsPage() {
  const { data: config, isLoading } = useUpstreamConfig();
  const updateUpstream = useUpdateUpstream();

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Upstream Providers</h1>
        <div className="glass p-6 animate-pulse">
          <div className="h-6 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Upstream Providers</h1>

      {/* Mode Selector */}
      <div className="glass p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Resolver Mode</h2>
        <div className="flex gap-4">
          {(['recursive', 'dot', 'doh'] as const).map((mode) => (
            <button
              key={mode}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                config?.mode === mode
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => updateUpstream.mutate({ mode })}
            >
              {mode === 'recursive' && '🔄 Recursive'}
              {mode === 'dot' && '🔒 DoT'}
              {mode === 'doh' && '🌐 DoH'}
            </button>
          ))}
        </div>
      </div>

      {/* DoT Providers */}
      {config?.mode === 'dot' && (
        <div className="glass p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">DoT Providers</h2>
          {config.dotProviders.length === 0 ? (
            <p className="text-white/60">No DoT providers configured</p>
          ) : (
            <div className="space-y-3">
              {config.dotProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div>
                    <div className="text-white font-medium">
                      {provider.name || provider.address}
                    </div>
                    <div className="text-white/60 text-sm">
                      {provider.address}:{provider.port}
                      {provider.sni && ` (SNI: ${provider.sni})`}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      provider.enabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DoH Providers */}
      {config?.mode === 'doh' && (
        <div className="glass p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">DoH Providers</h2>
          {config.dohProviders.length === 0 ? (
            <p className="text-white/60">No DoH providers configured</p>
          ) : (
            <div className="space-y-3">
              {config.dohProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div>
                    <div className="text-white font-medium">
                      {provider.name || 'DoH Provider'}
                    </div>
                    <div className="text-white/60 text-sm">{provider.endpoint}</div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      provider.enabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recursive Mode Info */}
      {config?.mode === 'recursive' && (
        <div className="glass p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recursive Mode</h2>
          <p className="text-white/70">
            Unbound is resolving queries directly from root servers. No upstream
            providers are used.
          </p>
        </div>
      )}
    </div>
  );
}
