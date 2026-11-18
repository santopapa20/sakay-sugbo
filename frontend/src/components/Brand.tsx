import { Info } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '../config';
import { useAppStore } from '../store/appStore';
import { IconButton } from './IconButton';

/** The small route-line mark: a line leaving one stop and arriving at another. */
export function BrandMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M6 22 C10 22 10 10 16 10 S22 22 26 14"
        fill="none"
        stroke="var(--color-mint-400)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="6" cy="22" r="2.6" fill="var(--color-night-800)" stroke="var(--color-mint-400)" strokeWidth="2" />
      <circle cx="26" cy="14" r="2.6" fill="var(--color-mint-400)" />
    </svg>
  );
}

/** The app name, with the button that opens "About the data". */
export function Brand() {
  const setAboutOpen = useAppStore((state) => state.setAboutOpen);
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[22px] font-bold uppercase leading-none tracking-[0.08em] text-fog-100">
          {APP_NAME}
        </h1>
        <p className="mt-0.5 text-[13px] leading-none text-fog-400">{APP_TAGLINE}</p>
      </div>
      <IconButton label="About the data" onClick={() => setAboutOpen(true)}>
        <Info className="size-5" />
      </IconButton>
    </div>
  );
}
