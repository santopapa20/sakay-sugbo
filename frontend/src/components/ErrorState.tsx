import { TriangleAlert } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  message: string;
  /** The technical message, shown small for anyone who wants to report it. */
  detail?: string | null;
  onRetry?: () => void;
}

/** Shown when something failed to load. Always says what still works and offers a retry. */
export function ErrorState({ title, message, detail, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <TriangleAlert className="size-5 text-amber-400" aria-hidden="true" />
      <p className="font-semibold text-fog-100">{title}</p>
      <p className="text-sm text-fog-400">{message}</p>
      {detail && <p className="break-all font-mono text-xs text-fog-500">{detail}</p>}
      {onRetry && (
        <Button className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
