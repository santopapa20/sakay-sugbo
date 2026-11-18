import { ArrowUpDown, ChevronRight, Footprints, LocateFixed, MapPinned, Route } from 'lucide-react';
import { Fragment } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { RouteBadge } from '../../components/RouteBadge';
import { useAppStore, type TripEnd } from '../../store/appStore';
import type { TripPoint } from '../../types';
import { PlaceCombobox } from '../search/PlaceCombobox';
import type { SearchResult } from '../search/searchIndex';
import type { RideLeg, TripOption } from './tripPlanner';
import { describeTrip, explainNoTrip, summariseTrip } from './tripText';

/** The "Find a ride" tab: choose a start and a destination, read the options. */
export function TripPanel() {
  const origin = useAppStore((state) => state.tripOrigin);
  const destination = useAppStore((state) => state.tripDestination);
  const status = useAppStore((state) => state.tripStatus);
  const result = useAppStore((state) => state.tripResult);
  const selected = useAppStore((state) => state.tripSelected);
  const picking = useAppStore((state) => state.picking);
  const swapTrip = useAppStore((state) => state.swapTrip);
  const setPicking = useAppStore((state) => state.setPicking);
  const selectTripOption = useAppStore((state) => state.selectTripOption);
  const selectRoute = useAppStore((state) => state.selectRoute);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Find a ride</p>
        <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-wide">
          Where are you going?
        </h2>
      </div>

      <div className="flex items-stretch gap-1">
        <div className="min-w-0 flex-1 rounded-md border border-night-600 bg-night-900">
          <TripField end="origin" point={origin} />
          <div className="ml-11 h-px bg-night-600" />
          <TripField end="destination" point={destination} />
        </div>
        <IconButton
          label="Swap start and destination"
          className="self-center"
          disabled={!origin && !destination}
          onClick={swapTrip}
        >
          <ArrowUpDown className="size-5" />
        </IconButton>
      </div>

      {picking && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-md bg-night-700 px-3 py-2">
          <p className="text-sm text-fog-100">
            Tap the map to set your {picking === 'origin' ? 'start' : 'destination'}.
          </p>
          <button
            type="button"
            onClick={() => setPicking(null)}
            className="shrink-0 text-sm font-semibold text-mint-400 underline-offset-4 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {(!origin || !destination) && !picking && (
        <p className="text-sm text-fog-400">
          Type a place, use your location, or tap the map to choose{' '}
          {!origin ? 'where you start' : 'where you want to go'}.
        </p>
      )}

      {status === 'searching' && (
        <p role="status" className="text-sm text-fog-400">
          Looking through the routes…
        </p>
      )}

      {status === 'done' && result && destination && (
        <section aria-labelledby="options-heading" aria-live="polite">
          {result.options.length > 0 ? (
            <>
              <h3 id="options-heading" className="eyebrow mb-2">
                {result.options.length} {result.options.length === 1 ? 'option' : 'options'}, fewest changes
                first
              </h3>
              <ul className="flex flex-col gap-2">
                {result.options.map((option, i) => (
                  <TripOptionCard
                    key={option.id}
                    option={option}
                    destination={destination}
                    expanded={i === selected}
                    onSelect={() => selectTripOption(i)}
                    onOpenRoute={selectRoute}
                  />
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-fog-400">
                Worked out from routes and stops mapped in OpenStreetMap, which have not been checked on
                the ground. Confirm with the driver or the signboard before you board. Jeepneys may also
                stop between mapped stops, so the real walk can be shorter. Fares and travel times are
                not shown because no verified source exists yet.
              </p>
            </>
          ) : (
            result.reason && (
              <EmptyState
                icon={<Route className="size-5" />}
                title={explainNoTrip(result.reason, result.straightLineM).title}
              >
                {explainNoTrip(result.reason, result.straightLineM).message}
              </EmptyState>
            )
          )}
        </section>
      )}
    </div>
  );
}

function TripField({ end, point }: { end: TripEnd; point: TripPoint | null }) {
  const setTripPoint = useAppStore((state) => state.setTripPoint);
  const setPicking = useAppStore((state) => state.setPicking);
  const picking = useAppStore((state) => state.picking);
  const locateUser = useAppStore((state) => state.locateUser);
  const locating = useAppStore((state) => state.locating);
  const isOrigin = end === 'origin';

  const onSelect = (result: SearchResult) => {
    if (result.kind === 'place') {
      const { place } = result;
      setTripPoint(end, { lng: place.lng, lat: place.lat, label: place.name, kind: 'place' });
    } else if (result.kind === 'stop') {
      setTripPoint(end, { ...result.position, label: result.title, kind: 'place' });
    }
  };

  const useMyLocation = async () => {
    const here = await locateUser();
    if (here) setTripPoint(end, here);
  };

  return (
    <PlaceCombobox
      label={isOrigin ? 'Start' : 'Destination'}
      placeholder={isOrigin ? 'Start: place, street or stop' : 'Destination: place, street or stop'}
      value={point?.label}
      kinds={['place', 'stop']}
      onSelect={onSelect}
      onClear={() => setTripPoint(end, null)}
      icon={
        // Hollow ring for the start, filled dot for the destination.
        <span
          className={`mx-1 block size-3 rounded-full border-2 border-mint-400 ${isOrigin ? '' : 'bg-mint-400'}`}
        />
      }
      trailing={
        <>
          {isOrigin && (
            <IconButton label="Start from my location" disabled={locating} onClick={useMyLocation} className="size-9">
              <LocateFixed className="size-4.5" />
            </IconButton>
          )}
          <IconButton
            label={`Choose the ${isOrigin ? 'start' : 'destination'} on the map`}
            active={picking === end}
            aria-pressed={picking === end}
            onClick={() => setPicking(picking === end ? null : end)}
            className="size-9"
          >
            <MapPinned className="size-4.5" />
          </IconButton>
        </>
      }
    />
  );
}

interface TripOptionCardProps {
  option: TripOption;
  destination: TripPoint;
  expanded: boolean;
  onSelect: () => void;
  onOpenRoute: (id: string) => void;
}

function TripOptionCard({ option, destination, expanded, onSelect, onOpenRoute }: TripOptionCardProps) {
  const rides = option.legs.filter((leg): leg is RideLeg => leg.kind === 'ride');
  const steps = describeTrip(option, destination);

  return (
    <li
      className={`rounded-md border transition-colors ${
        expanded ? 'border-fog-400 bg-night-700/60' : 'border-night-600 hover:border-night-500'
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left"
      >
        <span className="flex shrink-0 items-center gap-1.5">
          {rides.map((ride, i) => (
            <Fragment key={ride.direction.id}>
              {i > 0 && <ChevronRight className="size-4 text-fog-500" aria-label="then" />}
              <RouteBadge code={ride.direction.code} colour={ride.direction.colour} />
            </Fragment>
          ))}
        </span>
        <span className="min-w-0 flex-1 text-[13px] text-fog-300">{summariseTrip(option)}</span>
      </button>

      {expanded && (
        <ol className="flex flex-col gap-3 border-t border-night-600 px-3 pb-3 pt-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center" aria-hidden="true">
                {step.kind === 'walk' ? (
                  <Footprints className="size-4.5 text-fog-400" />
                ) : (
                  <span className="size-3 rounded-full" style={{ backgroundColor: step.colour }} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-fog-100">{step.title}</p>
                {step.detail && <p className="mt-0.5 text-sm text-fog-400">{step.detail}</p>}
              </div>
            </li>
          ))}
          <li className="flex flex-wrap gap-2 pl-9">
            {rides.map((ride) => (
              <Button key={ride.direction.id} className="h-9 px-3 text-sm" onClick={() => onOpenRoute(ride.direction.id)}>
                See all of {ride.direction.code}
              </Button>
            ))}
          </li>
        </ol>
      )}
    </li>
  );
}
