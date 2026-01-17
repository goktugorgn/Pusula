/**
 * Self-Test page
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Clock,
  CheckCheck,
} from 'lucide-react';
import api from '@/api/client';
import { GlassCard, ActionButton } from '@/components';
import { useToast } from '@/hooks/useToast';

interface TestStep {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface TestResult {
  passed: boolean;
  steps: TestStep[];
  totalDuration: number;
}

const stepLabels: Record<string, string> = {
  config_validation: 'Configuration Validation',
  upstream_connectivity: 'Upstream Connectivity',
  resolver_functionality: 'Resolver Functionality',
  health_observation: 'Health Observation',
};

export function SelfTestPage() {
  const { addToast } = useToast();
  const [result, setResult] = useState<TestResult | null>(null);
  const [copied, setCopied] = useState(false);

  const runTest = useMutation({
    mutationFn: () => api.runSelfTest(),
    onSuccess: (data) => {
      setResult(data);
      if (data.passed) {
        addToast('success', 'All tests passed!');
      } else {
        addToast('warning', 'Some tests failed. Check details below.');
      }
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to run self-test');
    },
  });

  const copyDiagnostics = () => {
    if (!result) return;

    const summary = [
      '=== Pusula Self-Test Results ===',
      `Overall: ${result.passed ? 'PASS' : 'FAIL'}`,
      `Duration: ${result.totalDuration}ms`,
      '',
      '--- Steps ---',
      ...result.steps.map((step) => 
        `${step.passed ? '✓' : '✗'} ${stepLabels[step.name] || step.name} (${step.duration}ms)${
          step.error ? `\n  Error: ${step.error}` : ''
        }`
      ),
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('success', 'Diagnostics copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Self-Test</h1>
          <p className="text-slate-500">Run comprehensive DNS resolver diagnostics</p>
        </div>
        <ActionButton
          onClick={() => runTest.mutate()}
          isLoading={runTest.isPending}
          icon={<Play className="w-4 h-4" />}
        >
          Run Self-Test
        </ActionButton>
      </div>

      {/* Test steps */}
      <GlassCard>
        <div className="space-y-4">
          {runTest.isPending ? (
            // Running state
            <>
              {Object.entries(stepLabels).map(([key, label], index) => (
                <div
                  key={key}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                    ${index === 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/30 border-slate-700/50'}
                  `}
                >
                  {index === 0 ? (
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500">
                      {index + 1}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className={index === 0 ? 'text-blue-400' : 'text-slate-400'}>{label}</p>
                  </div>
                </div>
              ))}
            </>
          ) : result ? (
            // Results state
            <>
              {result.steps.map((step, index) => (
                <div
                  key={step.name}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                    ${step.passed
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center
                    ${step.passed ? 'bg-emerald-500/20' : 'bg-red-500/20'}
                  `}>
                    {step.passed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={step.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {stepLabels[step.name] || step.name}
                    </p>
                    {step.error && (
                      <p className="text-sm text-red-300 mt-1">{step.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {step.duration}ms
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className={`flex items-center justify-between p-4 rounded-xl border mt-4
                ${result.passed
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
                }
              `}>
                <div className="flex items-center gap-3">
                  {result.passed ? (
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  )}
                  <span className={result.passed ? 'text-emerald-400' : 'text-amber-400'}>
                    {result.passed ? 'All tests passed' : 'Some tests failed'}
                  </span>
                </div>
                <span className="text-slate-500">
                  Total: {result.totalDuration}ms
                </span>
              </div>

              {/* Copy button */}
              <button
                onClick={copyDiagnostics}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mt-4"
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy diagnostics to clipboard'}
              </button>
            </>
          ) : (
            // Initial state
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 border border-slate-700/50 
                              flex items-center justify-center">
                <Play className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-2">No test results yet</p>
              <p className="text-sm text-slate-500">
                Click "Run Self-Test" to check resolver health
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Test description */}
      <GlassCard>
        <h3 className="text-lg font-medium text-slate-200 mb-4">What does this test?</h3>
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-slate-300">Configuration Validation:</strong>{' '}
            Runs unbound-checkconf to verify configuration syntax.
          </p>
          <p>
            <strong className="text-slate-300">Upstream Connectivity:</strong>{' '}
            Tests TLS handshake for DoT or HTTPS connectivity for DoH upstreams.
          </p>
          <p>
            <strong className="text-slate-300">Resolver Functionality:</strong>{' '}
            Verifies Unbound is responding to queries correctly.
          </p>
          <p>
            <strong className="text-slate-300">Health Observation:</strong>{' '}
            Monitors error rates over a short observation window.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

export default SelfTestPage;
