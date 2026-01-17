/**
 * StatCard - Dashboard metric card
 */

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  variant = 'default',
  isLoading = false,
}: StatCardProps) {
  const variantStyles = {
    default: 'border-slate-700/50',
    success: 'border-emerald-500/30 shadow-glow-success',
    warning: 'border-amber-500/30',
    danger: 'border-red-500/30 shadow-glow-danger',
  };

  const trendIcons = {
    up: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    down: <TrendingDown className="w-4 h-4 text-red-400" />,
    neutral: <Minus className="w-4 h-4 text-slate-400" />,
  };

  if (isLoading) {
    return (
      <div className={`glass-card ${variantStyles[variant]} animate-pulse`}>
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-slate-700/50 rounded w-24" />
            <div className="h-8 bg-slate-700/50 rounded w-32" />
            <div className="h-3 bg-slate-700/50 rounded w-20" />
          </div>
          <div className="w-10 h-10 bg-slate-700/50 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card ${variantStyles[variant]} transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-2">
              {trend && (
                <span className="flex items-center gap-1">
                  {trendIcons[trend]}
                  {trendValue && (
                    <span className={`text-sm ${
                      trend === 'up' ? 'text-emerald-400' :
                      trend === 'down' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {trendValue}
                    </span>
                  )}
                </span>
              )}
              {subtitle && (
                <span className="text-sm text-slate-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
