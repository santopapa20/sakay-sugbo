import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one main action in a view; secondary = everything else. */
  variant?: 'primary' | 'secondary';
}

const LOOK = {
  primary: 'bg-mint-400 text-night-950 hover:bg-mint-300 active:bg-mint-600',
  secondary: 'border border-night-500 text-fog-100 hover:bg-night-700 active:bg-night-600',
};

export function Button({ variant = 'secondary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-sm px-4 text-[15px] font-semibold transition-colors duration-150 disabled:opacity-50 ${LOOK[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
