/**
 * ActionButton - Button with loading and icon support
 */

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function ActionButton({
  children,
  onClick,
  icon,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
}: ActionButtonProps) {
  const variantStyles = {
    primary: 'glass-button',
    secondary: 'glass-button-secondary',
    danger: 'glass-button-danger',
    ghost: 'px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: '',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${variantStyles[variant]}
        ${size !== 'md' ? sizeStyles[size] : ''}
        inline-flex items-center justify-center gap-2
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

export default ActionButton;
