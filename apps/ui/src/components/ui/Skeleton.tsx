/**
 * Skeleton - Loading placeholder components
 */

import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  animation?: 'pulse' | 'shimmer' | 'none';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer',
    none: '',
  };

  return (
    <div
      className={`
        bg-white/20
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={{
        width: width || (variant === 'circular' ? '40px' : '100%'),
        height: height || (variant === 'circular' ? '40px' : undefined),
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

// ============================================================================
// Preset Skeletons
// ============================================================================

export function SkeletonCard() {
  return (
    <div className="glass p-6 rounded-2xl">
      <Skeleton variant="text" width="40%" className="mb-4" />
      <Skeleton variant="text" width="60%" height="2rem" className="mb-2" />
      <Skeleton variant="text" width="30%" />
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={`${size}px`}
      height={`${size}px`}
    />
  );
}

export default Skeleton;
