/**
 * Badge - Status badges and mode indicators
 */

import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

const variantClasses = {
  default: 'bg-white/20 text-white',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
};

const dotColors = {
  default: 'bg-white',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${variantClasses[variant]}
        ${sizeClasses[size]}
      `}
    >
      {dot && (
        <span
          className={`
            w-2 h-2 rounded-full
            ${dotColors[variant]}
            ${pulse ? 'animate-pulse' : ''}
          `}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// ============================================================================
// ModeBadge - Specific badge for resolver modes
// ============================================================================

export interface ModeBadgeProps {
  mode: 'recursive' | 'dot' | 'doh';
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  const modeConfig = {
    recursive: { label: '🔄 Recursive', variant: 'info' as const },
    dot: { label: '🔒 DoT', variant: 'success' as const },
    doh: { label: '🌐 DoH', variant: 'success' as const },
  };

  const config = modeConfig[mode];

  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

export default Badge;
