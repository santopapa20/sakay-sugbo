import { SearchX, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { RouteBadge } from '../../components/RouteBadge';
import { useAppStore } from '../../store/appStore';
import type { RouteGroup } from '../../types';
import { formatDistance } from '../../utils/geo';
import { normalise } from '../../utils/text';

/** One row in a list of routes: press the row to open the route, the star to save it. */
export function RouteCard({ group }: { group: RouteGroup }) {
  const selectRoute = useAppStore((state) => state.selectRoute);
  const saved = useAppStore((state) => state.favourites.routeCodes.includes(group.code));
  const toggleFavouriteRoute = useAppStore((state) => state.toggleFavouriteRoute);

  const first = group.directions[0]!;
  const name = group.directions.find((d) => d.name)?.name ?? 'Jeepney route';
  const longest = Math.max(...group.directions.map((d) => d.lengthM));

  return (
    <li className="flex items-center rounded-md border border-night-600 transition-colors hover:border-night-500">
      <button
        type="button"
        onClick={() => selectRoute(first.id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-md py-2.5 pl-3 text-left"
      >
        <RouteBadge code={group.code} colour={group.colour} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-fog-100">{name}</span>
          <span className="block truncate text-[13px] text-fog-400">
            {group.directions.length} {group.directions.length === 1 ? 'direction' : 'directions'} mapped ·
            up to {formatDistance(longest)}
          </span>
        </span>
      </button>
      <IconButton
        label={saved ? `Remove route ${group.code} from saved` : `Save route ${group.code}`}
        aria-pressed={saved}
        active={saved}
        onClick={() => toggleFavouriteRoute(group.code)}
      >
        <Star className="size-5" fill={saved ? 'currentColor' : 'none'} />
      </IconButton>
    </li>
  );
}

/** The Routes tab: every mapped route code, with a box to narrow the list. */
export function RoutesPanel() {
  const groups = useAppStore((state) => state.groups);
  const [filter, setFilter] = useState('');

  const shown = useMemo(() => {
    const wanted = normalise(filter);
    if (!wanted) return groups;
    return groups.filter((group) =>
      normalise(`${group.code} ${group.directions.map((d) => d.name ?? '').join(' ')}`).includes(wanted),
    );
  }, [groups, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="eyebrow">Routes</p>
        <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-wide">
          {groups.length} jeepney codes
        </h2>
      </div>

      <input
        type="search"
        aria-label="Filter routes by code or name"
        placeholder="Filter by code or name, e.g. 13C or Lahug"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="h-11 rounded-sm border border-night-600 bg-night-900 px-3 text-[15px] text-fog-100 placeholder:text-fog-500"
      />

      {shown.length === 0 ? (
        <EmptyState icon={<SearchX className="size-5" />} title={`No route matches “${filter.trim()}”`}>
          Only routes that are mapped cleanly in OpenStreetMap are listed, so a real route can be missing.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((group) => (
            <RouteCard key={group.code} group={group} />
          ))}
        </ul>
      )}
    </div>
  );
}
