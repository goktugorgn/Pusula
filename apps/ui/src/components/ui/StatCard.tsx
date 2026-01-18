/**
 * StatCard - Display a metric with label and optional trend
 */

import type { ReactNode } from 'react';
import GlassCard from './GlassCard';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  loading = false,
}: StatCardProps) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-white/50',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  if (loading) {
    return (
      <GlassCard padding="lg">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/2 mb-3" />
          <div className="h-8 bg-white/20 rounded w-3/4" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/60 text-sm font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {trend && trendValue && (
            <p className={`text-sm mt-1 ${trendColors[trend]}`}>
              {trendIcons[trend]} {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-2xl opacity-60">{icon}</div>
        )}
      </div>
    </GlassCard>
  );
}

export default StatCard;
