import {
  Building2,
  BusFront,
  GraduationCap,
  Hospital,
  Landmark,
  Ship,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { PlaceCategory } from '../../types';

const CATEGORIES: { id: PlaceCategory; label: string; icon: LucideIcon }[] = [
  { id: 'terminal', label: 'Terminals', icon: BusFront },
  { id: 'transport', label: 'Ports', icon: Ship },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'hospital', label: 'Hospitals', icon: Hospital },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'government', label: 'Government', icon: Building2 },
  { id: 'landmark', label: 'Landmarks', icon: Landmark },
];

/**
 * A row of chips that show one kind of place on the map at a time.
 * Pressing the active chip again hides its places.
 */
export function CategoryFilter({ className = '' }: { className?: string }) {
  const active = useAppStore((state) => state.activeCategory);
  const setCategory = useAppStore((state) => state.setCategory);

  return (
    <div
      role="group"
      aria-label="Show places on the map"
      // The row scrolls sideways on narrow screens instead of wrapping over the map.
      className={`flex gap-2 overflow-x-auto [scrollbar-width:none] ${className}`}
    >
      {CATEGORIES.map(({ id, label, icon: Icon }) => {
        const pressed = active === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={pressed}
            onClick={() => setCategory(pressed ? null : id)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold shadow-panel transition-colors duration-150 ${
              pressed
                ? 'border-cyan-400 bg-cyan-400 text-night-950'
                : 'border-night-600 bg-night-800/95 text-fog-300 hover:border-night-500 hover:text-fog-100'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
