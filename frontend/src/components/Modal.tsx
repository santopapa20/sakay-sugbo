import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A dialog box over the page.
 *
 * It uses the browser's own <dialog> element. That gives us the hard parts
 * for free: the Escape key closes it, keyboard focus stays inside it, and
 * focus returns to the button that opened it.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dimmed area outside the box lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="panel m-auto max-h-[86dvh] w-[min(560px,calc(100vw-24px))] p-0 text-fog-100 backdrop:bg-night-950/75"
    >
      <div className="flex max-h-[86dvh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-night-600 py-2 pl-5 pr-2">
          <h2 id={titleId} className="font-display text-2xl font-semibold tracking-wide">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="scroll-area px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
