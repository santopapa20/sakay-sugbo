import { BusFront, Compass, Route, Star, type LucideIcon } from 'lucide-react';
import { useAppStore, type Tab } from '../store/appStore';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'trip', label: 'Find a ride', icon: Route },
  { id: 'routes', label: 'Routes', icon: BusFront },
  { id: 'saved', label: 'Saved', icon: Star },
];

/** Desktop: the four sections as a row of tabs at the top of the side panel. */
export function TabBar() {
  const tab = useAppStore((state) => state.tab);
  const setTab = useAppStore((state) => state.setTab);
  return (
    <nav aria-label="Sections" className="flex border-b border-night-600">
      {TABS.map(({ id, label }) => {
        const current = tab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`relative h-11 flex-1 text-sm font-semibold transition-colors ${
              current ? 'text-fog-100' : 'text-fog-400 hover:text-fog-100'
            }`}
          >
            {label}
            {current && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-mint-400" />}
          </button>
        );
      })}
    </nav>
  );
}

/** Phone: the same four sections as a bar along the bottom, within thumb reach. */
export function BottomNav() {
  const tab = useAppStore((state) => state.tab);
  const setTab = useAppStore((state) => state.setTab);
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-night-600 bg-night-800 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const current = tab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
              current ? 'text-mint-400' : 'text-fog-400'
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
