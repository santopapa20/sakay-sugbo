import { ArrowLeft, ExternalLink, Star } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { RouteBadge } from '../../components/RouteBadge';
import { useAppStore } from '../../store/appStore';
import type { RouteDirection } from '../../types';
import { formatDistance } from '../../utils/geo';
import { destinationLabel, originLabel, viaStreets } from './routeModel';

/**
 * Everything known about one direction of a route, as text.
 * This is the non-map way to read a route, so nothing here depends on seeing the line.
 */
export function RouteDetail({ route }: { route: RouteDirection }) {
  const group = useAppStore((state) => state.groups.find((g) => g.code === route.code));
  const selectRoute = useAppStore((state) => state.selectRoute);
  const selectStop = useAppStore((state) => state.selectStop);
  const selectedStopId = useAppStore((state) => state.selectedStopId);
  const saved = useAppStore((state) => state.favourites.routeCodes.includes(route.code));
  const toggleFavouriteRoute = useAppStore((state) => state.toggleFavouriteRoute);

  const directions = group?.directions ?? [route];
  const streets = viaStreets(route);

  return (
    <article className="flex flex-col gap-5">
      <header>
        <div className="-ml-2 flex items-center justify-between">
          <IconButton label="Back" onClick={() => selectRoute(null)}>
            <ArrowLeft className="size-5" />
          </IconButton>
          <IconButton
            label={saved ? `Remove route ${route.code} from saved` : `Save route ${route.code}`}
            aria-pressed={saved}
            active={saved}
            onClick={() => toggleFavouriteRoute(route.code)}
          >
            <Star className="size-5" fill={saved ? 'currentColor' : 'none'} />
          </IconButton>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <RouteBadge code={route.code} colour={route.colour} size="lg" />
          <h2 className="min-w-0 text-lg font-semibold leading-snug text-fog-100">
            {route.name ?? 'Jeepney route'}
          </h2>
        </div>
      </header>

      {/* Each direction is its own line on the map, so the user picks which one to look at. */}
      {/* min-w-0: a fieldset refuses to shrink below its content unless told it may. */}
      <fieldset className="min-w-0">
        <legend className="eyebrow mb-2">Direction</legend>
        <div className="flex flex-col gap-1.5">
          {directions.map((direction) => {
            const current = direction.id === route.id;
            return (
              <label
                key={direction.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint-400 ${
                  current ? 'border-fog-400 bg-night-700' : 'border-night-600 hover:border-night-500'
                }`}
              >
                <input
                  type="radio"
                  name="direction"
                  className="sr-only"
                  checked={current}
                  onChange={() => selectRoute(direction.id)}
                />
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full border-2"
                  style={{
                    borderColor: route.colour,
                    backgroundColor: current ? route.colour : 'transparent',
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[15px]">
                    <span className="text-fog-300">{originLabel(direction)}</span>
                    <span className="mx-1.5 text-fog-500">to</span>
                    <span className="font-semibold text-fog-100">{destinationLabel(direction)}</span>
                  </span>
                  {/* The main streets tell apart variants that share the same two ends. */}
                  <span className="block truncate text-[13px] text-fog-400">
                    via {viaStreets(direction, 3).join(', ') || 'streets not named in the data'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Fact term="Length" value={formatDistance(route.lengthM)} />
        <Fact term="Mapped stops" value={String(route.stops.length)} />
        <Fact term="Operator" value={route.operator?.split(';').join(', ') ?? 'Not recorded'} wide />
        {streets.length > 0 && <Fact term="Runs along" value={streets.join(' · ')} wide />}
        <Fact term="Fare" value="Not shown. No verified fare source yet." wide />
      </dl>

      <section aria-labelledby="stops-heading">
        <h3 id="stops-heading" className="eyebrow mb-2">
          Stops in order
        </h3>
        <ol className="relative">
          {/* The vertical line joining the stops, in the route's colour. */}
          <span
            aria-hidden="true"
            className="absolute bottom-5 left-[17px] top-5 w-0.5 opacity-50"
            style={{ backgroundColor: route.colour }}
          />
          {route.stops.map((stop, i) => {
            const terminal = i === 0 || i === route.stops.length - 1;
            const current = stop.id === selectedStopId;
            return (
              <li key={`${stop.id}-${i}`}>
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => selectStop(current ? null : stop.id)}
                  className={`relative flex w-full items-center gap-3 rounded-sm py-2 pl-2.5 pr-2 text-left hover:bg-night-700 ${
                    current ? 'bg-night-700' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`shrink-0 rounded-full border-2 bg-night-800 ${terminal ? 'size-4' : 'mx-0.5 size-3'}`}
                    style={{
                      borderColor: route.colour,
                      backgroundColor: current || terminal ? route.colour : undefined,
                    }}
                  />
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${terminal ? 'font-semibold text-fog-100' : 'text-fog-300'}`}>
                    {stop.name ?? 'Unnamed stop'}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-fog-500">{formatDistance(stop.alongM)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="border-t border-night-600 pt-3 text-[13px] text-fog-400">
        Mapped by OpenStreetMap contributors and not yet checked on the ground. Jeepneys may also
        load and unload between the stops listed.{' '}
        <a
          href={`https://www.openstreetmap.org/relation/${route.osmRelationId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-mint-400 underline-offset-4 hover:underline"
        >
          View or correct this route on OpenStreetMap
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </footer>
    </article>
  );
}

function Fact({ term, value, wide = false }: { term: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="eyebrow">{term}</dt>
      <dd className="mt-0.5 text-fog-100">{value}</dd>
    </div>
  );
}
