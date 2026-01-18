/**
 * Self-Test Page - Run diagnostics
 */

import { useSelfTest } from '../api';
import type { TestStep } from '../api';

function StepIndicator({ status }: { status: 'pass' | 'warn' | 'fail' | 'pending' }) {
  const colors = {
    pass: 'bg-green-500',
    warn: 'bg-yellow-500',
    fail: 'bg-red-500',
    pending: 'bg-gray-500 animate-pulse',
  };

  return <span className={`w-3 h-3 rounded-full ${colors[status]}`} />;
}

function StepRow({ step }: { step: TestStep }) {
  const names: Record<string, string> = {
    config_validation: 'Configuration Validation',
    upstream_connectivity: 'Upstream Connectivity',
    resolver_functionality: 'Resolver Functionality',
    observation_window: 'Health Observation',
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
      <div className="flex items-center gap-3">
        <StepIndicator status={step.status} />
        <div>
          <div className="text-white font-medium">{names[step.name] || step.name}</div>
          {step.error && <div className="text-red-400 text-sm">{step.error}</div>}
        </div>
      </div>
      <div className="text-white/60 text-sm">{step.durationMs}ms</div>
    </div>
  );
}

export default function SelfTestPage() {
  const selfTest = useSelfTest();

  const handleRunTest = () => {
    selfTest.mutate();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Self-Test</h1>
        <button
          onClick={handleRunTest}
          disabled={selfTest.isPending}
          className="btn-primary"
        >
          {selfTest.isPending ? 'Running...' : 'Run Test'}
        </button>
      </div>

      {!selfTest.data && !selfTest.isPending && (
        <div className="glass p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Run Diagnostics
          </h2>
          <p className="text-white/70">
            Click "Run Test" to verify configuration, connectivity, and resolver
            functionality.
          </p>
        </div>
      )}

      {selfTest.isPending && (
        <div className="glass p-8 text-center">
          <div className="text-5xl mb-4 animate-spin">⚙️</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Running Tests...
          </h2>
          <p className="text-white/70">This may take up to 60 seconds.</p>
        </div>
      )}

      {selfTest.data && (
        <div className="space-y-6">
          {/* Summary */}
          <div
            className={`glass p-6 border-l-4 ${
              selfTest.data.summary.status === 'pass'
                ? 'border-green-500'
                : selfTest.data.summary.status === 'warn'
                  ? 'border-yellow-500'
                  : 'border-red-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">
                {selfTest.data.summary.status === 'pass' && '✅'}
                {selfTest.data.summary.status === 'warn' && '⚠️'}
                {selfTest.data.summary.status === 'fail' && '❌'}
              </span>
              <h2 className="text-xl font-semibold text-white capitalize">
                {selfTest.data.summary.status}
              </h2>
            </div>
            <p className="text-white/70">
              Completed in {selfTest.data.totalDurationMs}ms
            </p>
            {selfTest.data.summary.recommendations.length > 0 && (
              <div className="mt-4">
                <h3 className="text-white/80 text-sm mb-2">Recommendations:</h3>
                <ul className="list-disc list-inside text-white/60 text-sm">
                  {selfTest.data.summary.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="glass p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Test Steps</h2>
            <div className="space-y-3">
              {selfTest.data.steps.map((step) => (
                <StepRow key={step.name} step={step} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
