import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the button does, read out by screen readers and shown as a tooltip. */
  label: string;
  children: ReactNode;
  /** "ghost" sits inside a panel; "solid" floats on the map by itself. */
  variant?: 'ghost' | 'solid';
  active?: boolean;
}

/** A square button holding only an icon. 44px so it is easy to hit on a phone. */
export function IconButton({
  label,
  children,
  variant = 'ghost',
  active = false,
  className = '',
  ...rest
}: IconButtonProps) {
  const look =
    variant === 'solid'
      ? 'panel hover:bg-night-700 active:bg-night-600'
      : 'rounded-sm hover:bg-night-700 active:bg-night-600';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center transition-colors duration-150 disabled:opacity-40 ${look} ${
        active ? 'text-mint-400' : 'text-fog-300 hover:text-fog-100'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
