import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppStore, type Toast } from '../store/appStore';

const ICON = {
  info: <Info className="size-4.5 text-cyan-400" />,
  success: <CircleCheck className="size-4.5 text-mint-400" />,
  warning: <TriangleAlert className="size-4.5 text-amber-400" />,
};

/** Short messages that appear, say one thing, and leave by themselves after five seconds. */
export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismiss = useAppStore((state) => state.dismissToast);

  return (
    <div
      // "polite" makes screen readers announce the message without interrupting.
      aria-live="polite"
      className="pointer-events-none absolute left-3 right-[68px] top-[132px] z-40 flex flex-col gap-2 lg:bottom-6 lg:left-[calc(50%+220px)] lg:right-auto lg:top-auto lg:w-[380px] lg:-translate-x-1/2"
    >
      <AnimatePresence>
        {toasts.map((toast: Toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="panel pointer-events-auto flex items-start gap-2.5 py-2.5 pl-3 pr-1.5"
          >
            <span className="mt-0.5" aria-hidden="true">
              {ICON[toast.tone]}
            </span>
            <p className="flex-1 text-sm text-fog-100">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => dismiss(toast.id)}
              className="grid size-8 place-items-center rounded-sm text-fog-400 hover:bg-night-700 hover:text-fog-100"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
