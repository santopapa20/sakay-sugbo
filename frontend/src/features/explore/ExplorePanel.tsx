import { ArrowRight, ChevronRight, MapPinOff, Star, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { RouteBadge } from '../../components/RouteBadge';
import { NEARBY_RADIUS_M } from '../../config';
import { useAppStore, type Focus } from '../../store/appStore';
import type { RouteDirection, TripPoint } from '../../types';
import { formatDistance } from '../../utils/geo';
import { destinationLabel, routesNear, streetAt, type NearbyRoute } from '../routes/routeModel';
import { categoryLabel } from '../search/searchIndex';

/** The Explore tab: an invitation to tap the map, or the answer to "what passes here?". */
export function ExplorePanel() {
  const focus = useAppStore((state) => state.focus);
  return focus ? <PointPanel focus={focus} /> : <ExploreIntro />;
}

function ExploreIntro() {
  const meta = useAppStore((state) => state.meta);
  const setTab = useAppStore((state) => state.setTab);
  const setAboutOpen = useAppStore((state) => state.setAboutOpen);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Explore</p>
        <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-wide">
          Which jeepney passes here?
        </h2>
        <p className="mt-2 text-fog-400">
          Tap any spot on the map to see the routes that run within {NEARBY_RADIUS_M} metres of it.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => setTab('trip')}>
          Find a ride
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button className="flex-1" onClick={() => setTab('routes')}>
          All routes
        </Button>
      </div>

      {meta && (
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="flex items-center justify-between gap-3 rounded-md border border-night-600 px-3 py-2.5 text-left hover:bg-night-700"
        >
          <span className="text-sm text-fog-400">
            <span className="font-semibold text-fog-100">{meta.counts.routeCodes} route codes</span>,{' '}
            {meta.counts.routeDirections} directions, from OpenStreetMap. Not yet checked on the ground.
          </span>
          <ChevronRight className="size-4 shrink-0 text-fog-500" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Groups nearby directions by code, keeping the order "nearest code first". */
function groupByCode(nearby: NearbyRoute[]): NearbyRoute[][] {
  const groups = new Map<string, NearbyRoute[]>();
  for (const item of nearby) {
    const list = groups.get(item.direction.code);
    if (list) list.push(item);
    else groups.set(item.direction.code, [item]);
  }
  return [...groups.values()];
}

function PointPanel({ focus }: { focus: NonNullable<Focus> }) {
  const routes = useAppStore((state) => state.routes);
  const clearFocus = useAppStore((state) => state.clearFocus);
  const selectRoute = useAppStore((state) => state.selectRoute);
  const setTripPoint = useAppStore((state) => state.setTripPoint);
  const favourites = useAppStore((state) => state.favourites);
  const toggleFavouritePlace = useAppStore((state) => state.toggleFavouritePlace);

  const place = focus.kind === 'place' ? focus.place : null;
  const point = place ?? (focus.kind === 'point' ? focus.point : null)!;
  const title = place?.name ?? 'Tapped point';
  const saved = place ? favourites.places.some((p) => p.id === place.id) : false;

  const groups = useMemo(
    () => groupByCode(routesNear(routes, point, NEARBY_RADIUS_M)),
    [routes, point],
  );

  const asTripPoint = (): TripPoint =>
    place
      ? { lng: place.lng, lat: place.lat, label: place.name, kind: 'place' }
      : {
          lng: point.lng,
          lat: point.lat,
          label: `Pinned point (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`,
          kind: 'pin',
        };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{place ? categoryLabel(place.category) : 'On the map'}</p>
          <h2 className="mt-1 font-display text-[26px] font-semibold leading-tight tracking-wide">{title}</h2>
          <p className="mt-0.5 text-sm text-fog-400">
            {place?.address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
          </p>
        </div>
        {place && (
          <IconButton
            label={saved ? `Remove ${place.name} from saved` : `Save ${place.name}`}
            aria-pressed={saved}
            active={saved}
            onClick={() => toggleFavouritePlace(place)}
          >
            <Star className="size-5" fill={saved ? 'currentColor' : 'none'} />
          </IconButton>
        )}
        <IconButton label="Close" onClick={clearFocus}>
          <X className="size-5" />
        </IconButton>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setTripPoint('origin', asTripPoint())}>
          Ride from here
        </Button>
        <Button variant="primary" className="flex-1" onClick={() => setTripPoint('destination', asTripPoint())}>
          Ride to here
        </Button>
      </div>

      <section aria-labelledby="nearby-heading">
        <h3 id="nearby-heading" className="eyebrow mb-2">
          Jeepneys within {NEARBY_RADIUS_M} m{groups.length > 0 && ` · ${groups.length}`}
        </h3>

        {groups.length === 0 ? (
          <EmptyState icon={<MapPinOff className="size-5" />} title="No mapped route passes here">
            None of the routes in the data comes within {NEARBY_RADIUS_M} metres of this spot. A
            jeepney may still serve it: several routes are not mapped yet.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((items) => (
              <NearbyGroup key={items[0]!.direction.code} items={items} onSelect={selectRoute} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NearbyGroup({ items, onSelect }: { items: NearbyRoute[]; onSelect: (id: string) => void }) {
  const first: RouteDirection = items[0]!.direction;
  return (
    <li className="rounded-md border border-night-600">
      <div className="flex items-center gap-3 px-3 pt-2.5">
        <RouteBadge code={first.code} colour={first.colour} />
        <span className="min-w-0 truncate text-sm text-fog-300">{first.name ?? 'Jeepney route'}</span>
      </div>
      <ul className="mt-1 pb-1">
        {items.map(({ direction, distanceM, alongM }) => {
          const street = streetAt(direction, alongM);
          // Some codes have several variants ("via Escario", "via Ramos"). Name the variant
          // when it differs from the heading, so two rows never look the same.
          const variant = direction.name && direction.name !== first.name ? direction.name : null;
          return (
            <li key={direction.id}>
              <button
                type="button"
                onClick={() => onSelect(direction.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-night-700"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fog-100">
                    Toward {destinationLabel(direction)}
                  </span>
                  <span className="block truncate text-[13px] text-fog-400">
                    {variant && `${variant} · `}
                    {formatDistance(distanceM)} away{street ? ` · on ${street}` : ''}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fog-500" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
