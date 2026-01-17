/**
 * GlassCard - Base glassmorphism container
 */

import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = '', hover = true }: GlassCardProps) {
  return (
    <div
      className={`
        glass-card
        ${hover ? 'hover:border-slate-600/50 hover:shadow-glow' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default GlassCard;
