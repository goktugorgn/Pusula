/**
 * ModeBadge - Display resolver mode
 */

import { Globe, Shield, Cloud } from 'lucide-react';

type Mode = 'recursive' | 'dot' | 'doh';

interface ModeBadgeProps {
  mode: Mode;
  size?: 'sm' | 'md' | 'lg';
}

const modeConfig = {
  recursive: {
    label: 'Recursive',
    icon: Globe,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  dot: {
    label: 'DoT',
    icon: Shield,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  doh: {
    label: 'DoH',
    icon: Cloud,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
};

export function ModeBadge({ mode, size = 'md' }: ModeBadgeProps) {
  const config = modeConfig[mode];
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.color} ${sizeStyles[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
}

export default ModeBadge;
