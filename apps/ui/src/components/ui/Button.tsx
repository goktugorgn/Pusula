/**
 * Button - Accessible button with variants
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantClasses = {
  primary: `
    bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700
    text-white shadow-lg shadow-indigo-500/25
    focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-transparent
  `,
  secondary: `
    bg-white/10 hover:bg-white/20 active:bg-white/25
    text-white border border-white/20
    focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent
  `,
  danger: `
    bg-red-500 hover:bg-red-600 active:bg-red-700
    text-white shadow-lg shadow-red-500/25
    focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-transparent
  `,
  ghost: `
    bg-transparent hover:bg-white/10 active:bg-white/15
    text-white/80 hover:text-white
    focus:ring-2 focus:ring-white/20
  `,
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-base rounded-xl gap-2',
  lg: 'px-6 py-3 text-lg rounded-xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-out
          outline-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span aria-hidden="true">{icon}</span>}
            <span>{children}</span>
            {icon && iconPosition === 'right' && <span aria-hidden="true">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
