/**
 * GlassCard - Primary container component with glassmorphism effect
 */

import type { ReactNode, HTMLAttributes } from 'react';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'dark' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderColor?: 'none' | 'default' | 'success' | 'warning' | 'danger';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantClasses = {
  default: 'bg-white/10 border-white/20',
  dark: 'bg-black/20 border-white/10',
  elevated: 'bg-white/15 border-white/25 shadow-xl',
};

const borderColorClasses = {
  none: '',
  default: 'border-l-4 border-l-white/30',
  success: 'border-l-4 border-l-green-500',
  warning: 'border-l-4 border-l-yellow-500',
  danger: 'border-l-4 border-l-red-500',
};

export function GlassCard({
  children,
  variant = 'default',
  padding = 'md',
  borderColor = 'none',
  className = '',
  ...props
}: GlassCardProps) {
  return (
    <div
      className={`
        backdrop-blur-xl rounded-2xl border
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${borderColorClasses[borderColor]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export default GlassCard;
