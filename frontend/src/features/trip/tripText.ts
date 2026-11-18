/**
 * Turns a trip option into plain sentences ("Ride 13C toward Talamban ...").
 * Kept apart from the screen so the wording can be unit tested, and so the
 * steps read the same to a screen reader as they look.
 */
import { MAX_WALK_M } from '../../config';
import type { TripPoint } from '../../types';
import { formatDistance } from '../../utils/geo';
import { destinationLabel } from '../routes/routeModel';
import type { NoTripReason, PointOnRoute, TripLeg, TripOption } from './tripPlanner';

export interface TripStep {
  kind: 'walk' | 'ride';
  title: string;
  detail: string | null;
  /** Route code and colour, for ride steps. */
  code?: string;
  colour?: string;
}

/** "at the PSBank Colon stop on Pelaez Street", using only what the data has. */
function describePoint(point: PointOnRoute): string {
  const stop = point.stop.name ? `at the ${point.stop.name} stop` : 'at the mapped stop';
  return point.street ? `${stop} on ${point.street}` : stop;
}

/** Under about 30 m you are effectively standing on the route already. */
const isNegligible = (metres: number) => metres < 30;

export function describeTrip(option: TripOption, destination: TripPoint): TripStep[] {
  const steps: TripStep[] = [];
  const { legs } = option;

  legs.forEach((leg: TripLeg, i) => {
    if (leg.kind === 'ride') {
      const stops = leg.stopsBetween.length;
      steps.push({
        kind: 'ride',
        code: leg.direction.code,
        colour: leg.direction.colour,
        title: `Ride ${leg.direction.code} toward ${destinationLabel(leg.direction)}`,
        detail:
          `Board ${describePoint(leg.board)}. ` +
          `Ride ${formatDistance(leg.distanceM)}` +
          (stops > 0 ? `, past ${stops} mapped ${stops === 1 ? 'stop' : 'stops'}` : '') +
          `. Get off ${describePoint(leg.alight)}.`,
      });
      return;
    }

    const next = legs[i + 1];
    const isLast = i === legs.length - 1;
    const isTransfer = !isLast && i > 0;
    const distance = formatDistance(leg.distanceM);

    if (isLast) {
      steps.push({
        kind: 'walk',
        title: isNegligible(leg.distanceM)
          ? `You arrive at ${destination.label}`
          : `Walk about ${distance} to ${destination.label}`,
        detail: null,
      });
    } else if (isTransfer && next?.kind === 'ride') {
      steps.push({
        kind: 'walk',
        title: isNegligible(leg.distanceM)
          ? `Change to ${next.direction.code} at the same spot`
          : `Walk about ${distance} to change to ${next.direction.code}`,
        detail: null,
      });
    } else if (next?.kind === 'ride' && !isNegligible(leg.distanceM)) {
      steps.push({
        kind: 'walk',
        title: `Walk about ${distance} to the ${next.board.stop.name ?? next.direction.code} stop`,
        detail: 'Straight-line distance. The walk along the streets is a little longer.',
      });
    }
  });

  return steps;
}

/** A one-line summary for the collapsed card: "1 change · 4.2 km ride · 350 m walk". */
export function summariseTrip(option: TripOption): string {
  const change = option.transfers === 0 ? 'No change' : option.transfers === 1 ? '1 change' : `${option.transfers} changes`;
  return `${change} · ${formatDistance(option.rideM)} ride · ${formatDistance(option.walkM)} walk`;
}

/** Why nothing was found, said plainly and without pretending to know more than the data does. */
export function explainNoTrip(reason: NoTripReason, straightLineM: number): { title: string; message: string } {
  switch (reason) {
    case 'too-close':
      return {
        title: 'These two points are close together',
        message: `They are about ${formatDistance(straightLineM)} apart in a straight line, which is quicker to walk than to ride.`,
      };
    case 'origin-not-served':
      return {
        title: 'No mapped route near the start',
        message:
          `None of the routes in the data passes within ${formatDistance(MAX_WALK_M * 2)} of your starting point. Try a start closer to a main road.`,
      };
    case 'destination-not-served':
      return {
        title: 'No mapped route near the destination',
        message:
          `None of the routes in the data passes within ${formatDistance(MAX_WALK_M * 2)} of your destination. Try a point closer to a main road.`,
      };
    case 'no-connection':
      return {
        title: 'No ride could be confirmed',
        message:
          'The mapped routes do not connect these two points with a direct ride or a single change. A way may still exist: some routes are missing from the data, and trips with two changes are not searched yet.',
      };
  }
}
