import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Shown when there is truthfully nothing to list, with a hint about what to do next. */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-night-500 p-4">
      <span className="text-fog-500" aria-hidden="true">
        {icon}
      </span>
      <p className="font-semibold text-fog-100">{title}</p>
      {children && <div className="text-sm text-fog-400">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
