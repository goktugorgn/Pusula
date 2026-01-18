/**
 * Self-Test Page
 * 
 * - Run self-test button
 * - Stepper with pass/warn/fail for each step
 * - Expandable details
 * - Copy diagnostics summary
 * - Quick link to upstreams on failure
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { postApi, getApi } from '../api/client';
import type { SelfTestResult, TestStep, StepStatus } from '../api/types';
import { GlassCard, Button, Badge, useToast } from '../components/ui';

// ============================================================================
// Helpers
// ============================================================================

const statusConfig: Record<StepStatus, { icon: string; color: string; bg: string; label: string }> = {
  pass: { icon: '✓', color: 'text-green-400', bg: 'bg-green-500/20', label: 'Passed' },
  warn: { icon: '⚠', color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Warning' },
  fail: { icon: '✕', color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// Step Component
// ============================================================================

interface StepRowProps {
  step: TestStep;
  index: number;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function StepRow({ step, isLast, expanded, onToggle }: StepRowProps) {
  const config = statusConfig[step.status];

  return (
    <div className="relative">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-white/10" />
      )}

      <div
        className={`
          flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-colors
          ${config.bg} hover:brightness-110
        `}
        onClick={onToggle}
      >
        {/* Step Icon */}
        <div className={`
          flex items-center justify-center w-10 h-10 rounded-full shrink-0
          ${config.bg} border-2 border-current ${config.color}
        `}>
          <span className="font-bold">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-white font-medium">{step.name}</span>
            <Badge size="sm" variant={step.status === 'pass' ? 'success' : step.status === 'warn' ? 'warning' : 'danger'}>
              {config.label}
            </Badge>
            {step.durationMs !== undefined && (
              <span className="text-white/40 text-sm">
                {formatDuration(step.durationMs)}
              </span>
            )}
          </div>

          {step.error && (
            <p className="text-red-400 text-sm">{step.error}</p>
          )}

          {/* Expandable Details */}
          {expanded && step.details && Object.keys(step.details).length > 0 && (
            <div className="mt-3 p-3 bg-black/20 rounded-lg">
              <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(step.details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Expand Indicator */}
        {step.details && Object.keys(step.details).length > 0 && (
          <div className={`text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Summary Component
// ============================================================================

interface SummaryProps {
  result: SelfTestResult;
}

function Summary({ result }: SummaryProps) {
  const { passed, warnings, failed } = useMemo(() => {
    const steps = result.steps || [];
    return {
      passed: steps.filter((s) => s.status === 'pass').length,
      warnings: steps.filter((s) => s.status === 'warn').length,
      failed: steps.filter((s) => s.status === 'fail').length,
    };
  }, [result.steps]);

  const total = (result.steps || []).length;
  const allPassed = result.summary.status === 'pass';
  const hasFailures = result.summary.status === 'fail';

  return (
    <GlassCard 
      padding="lg" 
      borderColor={allPassed ? 'success' : hasFailures ? 'danger' : 'warning'}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">
              {allPassed ? '✅' : hasFailures ? '❌' : '⚠️'}
            </span>
            <div>
              <h3 className="text-xl font-bold text-white">
                {allPassed ? 'All Tests Passed' : hasFailures ? 'Some Tests Failed' : 'Warnings Detected'}
              </h3>
              <p className="text-white/60 text-sm">
                Duration: {formatDuration(result.totalDurationMs)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">{passed}</div>
            <div className="text-white/50 text-xs">Passed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">{warnings}</div>
            <div className="text-white/50 text-xs">Warnings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{failed}</div>
            <div className="text-white/50 text-xs">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white/70">{total}</div>
            <div className="text-white/50 text-xs">Total</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {result.summary.recommendations && result.summary.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-white/60 text-sm mb-2">Recommendations:</div>
          <ul className="space-y-1">
            {result.summary.recommendations.map((rec, i) => (
              <li key={i} className="text-yellow-400 text-sm flex items-start gap-2">
                <span>💡</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SelfTestPage() {
  const { addToast } = useToast();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<SelfTestResult | null>(null);

  // Load last result on mount
  const { data: lastResult } = useQuery({
    queryKey: ['self-test-last'],
    queryFn: () => getApi<SelfTestResult>('/self-test/last').catch(() => null),
    staleTime: 60000,
  });

  // Run self-test mutation
  const runMutation = useMutation({
    mutationFn: () => postApi<SelfTestResult>('/self-test', {}),
    onSuccess: (data) => {
      setResult(data);
      setExpandedSteps(new Set());
      
      const failed = data.steps?.filter((s) => s.status === 'fail').length || 0;
      if (failed > 0) {
        addToast('error', `Self-test completed with ${failed} failure(s)`);
      } else {
        addToast('success', 'Self-test completed successfully');
      }
    },
    onError: (error) => {
      addToast('error', `Self-test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Use current result or last result
  const displayResult = result || lastResult;

  // Handlers
  const handleToggleStep = useCallback((index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (displayResult?.steps) {
      setExpandedSteps(new Set(displayResult.steps.map((_, i) => i)));
    }
  }, [displayResult]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSteps(new Set());
  }, []);

  const handleCopyDiagnostics = useCallback(() => {
    if (!displayResult) return;

    const lines: string[] = [
      '=== Pusula Self-Test Diagnostics ===',
      `Total Duration: ${formatDuration(displayResult.totalDurationMs)}`,
      `Overall Status: ${displayResult.summary.status.toUpperCase()}`,
      '',
      '--- Steps ---',
    ];

    displayResult.steps?.forEach((step, i) => {
      lines.push(
        `[${step.status.toUpperCase()}] ${i + 1}. ${step.name}`,
        `   Duration: ${formatDuration(step.durationMs)}`,
        step.error ? `   Error: ${step.error}` : '',
        Object.keys(step.details).length > 0 ? `   Details: ${JSON.stringify(step.details)}` : '',
        ''
      );
    });

    if (displayResult.summary.recommendations.length > 0) {
      lines.push('--- Recommendations ---');
      displayResult.summary.recommendations.forEach((rec) => {
        lines.push(`• ${rec}`);
      });
    }

    navigator.clipboard.writeText(lines.filter(Boolean).join('\n')).then(() => {
      addToast('success', 'Diagnostics copied to clipboard');
    }).catch(() => {
      addToast('error', 'Failed to copy to clipboard');
    });
  }, [displayResult, addToast]);

  // Check if there are upstream-related failures
  const hasUpstreamFailures = useMemo(() => {
    if (!displayResult?.steps) return false;
    return displayResult.steps.some(
      (s) => s.status === 'fail' && 
             (s.name.toLowerCase().includes('upstream') || 
              s.name.toLowerCase().includes('dns') ||
              s.name.toLowerCase().includes('forward'))
    );
  }, [displayResult]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Self-Test</h1>
          <p className="text-white/60 text-sm">Verify DNS resolver configuration and connectivity</p>
        </div>
        <Button
          onClick={() => runMutation.mutate()}
          loading={runMutation.isPending}
          icon="🔍"
        >
          Run Self-Test
        </Button>
      </div>

      {/* Running Indicator */}
      {runMutation.isPending && (
        <GlassCard padding="lg">
          <div className="flex items-center justify-center gap-4 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            <div className="text-white">
              <div className="font-medium">Running self-test...</div>
              <div className="text-white/60 text-sm">This may take a few seconds</div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Results */}
      {displayResult && !runMutation.isPending && (
        <>
          {/* Summary */}
          <Summary result={displayResult} />

          {/* Quick Actions on Failure */}
          {hasUpstreamFailures && (
            <GlassCard padding="md" borderColor="warning">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <div className="text-white font-medium">Upstream connectivity issues detected</div>
                    <div className="text-white/60 text-sm">Check your upstream configuration</div>
                  </div>
                </div>
                <Link to="/upstreams">
                  <Button variant="secondary" size="sm">
                    Go to Upstreams →
                  </Button>
                </Link>
              </div>
            </GlassCard>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleExpandAll}>
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
                Collapse All
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopyDiagnostics}>
              📋 Copy Diagnostics
            </Button>
          </div>

          {/* Steps */}
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-white mb-4">Test Steps</h3>
            <div className="space-y-3">
              {displayResult.steps?.map((step, index) => (
                <StepRow
                  key={index}
                  step={step}
                  index={index}
                  isLast={index === (displayResult.steps?.length || 0) - 1}
                  expanded={expandedSteps.has(index)}
                  onToggle={() => handleToggleStep(index)}
                />
              ))}
            </div>
          </GlassCard>
        </>
      )}

      {/* Empty State */}
      {!displayResult && !runMutation.isPending && (
        <GlassCard padding="lg">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-white mb-2">No test results</h3>
            <p className="text-white/60 mb-6">
              Run a self-test to verify your DNS resolver configuration
            </p>
            <Button onClick={() => runMutation.mutate()}>
              Run Self-Test
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
