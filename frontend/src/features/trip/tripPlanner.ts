/**
 * The trip finder: "which jeepney do I ride from here to there?"
 *
 * How it works, in plain words:
 *   1. Each route can be boarded or left only at its mapped stops. (A point
 *      picked anywhere on the line could be on a flyover or a bridge, where
 *      no jeepney can stop.)
 *   2. We find the stops within walking distance of the start and of the
 *      destination.
 *   3. DIRECT RIDE: a route that has a stop near the start and, further
 *      along in its direction of travel, a stop near the destination.
 *   4. ONE TRANSFER: a route A near the start and a route B near the
 *      destination that have stops within 150 m of each other, somewhere
 *      after you board A and before you get off B.
 *   5. Options are ranked by fewest transfers first, then by a "cost" that
 *      counts walking as four times as tiring as riding.
 *
 * It only ever uses the mapped routes and stops. If they do not connect two
 * places, it says so instead of guessing. In real life jeepneys also stop
 * between mapped stops, so a real trip can involve less walking than shown.
 *
 * This file has no React and no map code, so the same logic can move to the
 * Spring Boot backend later (see backend/README.md).
 */
import { MAX_WALK_M, TRANSFER_RADIUS_M } from '../../config';
import type { Coordinate, LngLat, RouteDirection, RouteStop } from '../../types';
import { haversineMetres, sliceLine } from '../../utils/geo';
import { streetAt } from '../routes/routeModel';

// ------------------------------------------------------------ result types

/** A mapped stop where you get on or off a jeepney. */
export interface PointOnRoute extends LngLat {
  alongM: number;
  /** The street the route is on here, when OpenStreetMap names it. */
  street: string | null;
  stop: RouteStop;
}

export interface WalkLeg {
  kind: 'walk';
  from: LngLat;
  to: LngLat;
  /** Straight-line distance; the real walk along streets is a little longer. */
  distanceM: number;
}

export interface RideLeg {
  kind: 'ride';
  direction: RouteDirection;
  board: PointOnRoute;
  alight: PointOnRoute;
  distanceM: number;
  /** The part of the route line you ride, for drawing on the map. */
  coordinates: Coordinate[];
  /** Mapped stops passed between boarding and getting off. */
  stopsBetween: RouteStop[];
}

export type TripLeg = WalkLeg | RideLeg;

export interface TripOption {
  id: string;
  legs: TripLeg[];
  transfers: number;
  walkM: number;
  rideM: number;
  /** Lower is better. Only used for ranking, never shown. */
  cost: number;
}

/** Why no option was found, so the screen can explain it honestly. */
export type NoTripReason =
  | 'too-close'
  | 'origin-not-served'
  | 'destination-not-served'
  | 'no-connection';

export interface TripResult {
  options: TripOption[];
  reason: NoTripReason | null;
  straightLineM: number;
}

// ----------------------------------------------------------------- tuning

/** One metre walked "costs" as much as this many metres ridden. */
const WALK_WEIGHT = 4;
/** Changing jeepneys costs as much as riding this many extra metres. */
const TRANSFER_PENALTY_M = 1500;
/** A ride shorter than this is not worth boarding for. */
const MIN_RIDE_M = 300;
/** Start and destination closer than this: just walk. */
const WALKABLE_M = 250;
const MAX_OPTIONS = 5;

// ---------------------------------------------------------------- network

/** One boarding point: a mapped stop and how far along the route it is. */
interface Sample extends LngLat {
  alongM: number;
  stop: RouteStop;
}

interface SampledRoute {
  direction: RouteDirection;
  samples: Sample[];
}

/** The routes prepared for searching. Build once, reuse for every trip. */
export interface TripNetwork {
  routes: SampledRoute[];
  /** Grid cell → stops inside it, each stored as [routeIndex, index of the stop on that route]. */
  grid: Map<string, [number, number][]>;
}

/** Grid cells are about 165 m across at Cebu's latitude. */
const CELL_DEGREES = 0.0015;
const CELL_METRES = 160;
const cellOf = (value: number) => Math.floor(value / CELL_DEGREES);

/** The places where a route can be boarded or left: its mapped stops, in travel order. */
function boardingPoints(direction: RouteDirection): Sample[] {
  const points: Sample[] = [];
  let furthest = -Infinity;
  for (const stop of direction.stops) {
    // A stop that appears to lie "behind" the previous one is out of order in
    // the data. Skip it rather than guess where on the line it belongs.
    if (stop.alongM <= furthest) continue;
    points.push({ lng: stop.lng, lat: stop.lat, alongM: stop.alongM, stop });
    furthest = stop.alongM;
  }
  return points;
}

export function buildTripNetwork(directions: RouteDirection[]): TripNetwork {
  const routes = directions.map((direction) => ({ direction, samples: boardingPoints(direction) }));
  const grid: TripNetwork['grid'] = new Map();
  routes.forEach((route, routeIndex) => {
    route.samples.forEach((sample, sampleIndex) => {
      const key = `${cellOf(sample.lng)}:${cellOf(sample.lat)}`;
      const cell = grid.get(key);
      if (cell) cell.push([routeIndex, sampleIndex]);
      else grid.set(key, [[routeIndex, sampleIndex]]);
    });
  });
  return { routes, grid };
}

interface NearSample {
  sampleIndex: number;
  distanceM: number;
}

/** Stops within `radiusM` of a point, grouped by route. */
function samplesNear(network: TripNetwork, point: LngLat, radiusM: number): Map<number, NearSample[]> {
  const reach = Math.ceil(radiusM / CELL_METRES);
  const cx = cellOf(point.lng);
  const cy = cellOf(point.lat);
  const found = new Map<number, NearSample[]>();
  for (let x = cx - reach; x <= cx + reach; x++) {
    for (let y = cy - reach; y <= cy + reach; y++) {
      for (const [routeIndex, sampleIndex] of network.grid.get(`${x}:${y}`) ?? []) {
        const sample = network.routes[routeIndex]!.samples[sampleIndex]!;
        const distanceM = haversineMetres(point, sample);
        if (distanceM > radiusM) continue;
        const list = found.get(routeIndex);
        if (list) list.push({ sampleIndex, distanceM });
        else found.set(routeIndex, [{ sampleIndex, distanceM }]);
      }
    }
  }
  return found;
}

/**
 * Routes within walking distance of a trip end.
 *
 * A big place such as a university campus is stored as one point in its
 * middle, which can be further than the normal walk from any road. So when
 * nothing is within the normal distance we look once more at double the
 * distance. The longer walk is then shown to the user, not hidden.
 */
function samplesWithinWalk(network: TripNetwork, point: LngLat): Map<number, NearSample[]> {
  const near = samplesNear(network, point, MAX_WALK_M);
  return near.size > 0 ? near : samplesNear(network, point, MAX_WALK_M * 2);
}

// ------------------------------------------------------------ leg builders

function pointOnRoute(route: SampledRoute, sampleIndex: number): PointOnRoute {
  const sample = route.samples[sampleIndex]!;
  return { ...sample, street: streetAt(route.direction, sample.alongM) };
}

function rideLeg(route: SampledRoute, boardIndex: number, alightIndex: number): RideLeg {
  const board = pointOnRoute(route, boardIndex);
  const alight = pointOnRoute(route, alightIndex);
  const { direction } = route;
  return {
    kind: 'ride',
    direction,
    board,
    alight,
    distanceM: alight.alongM - board.alongM,
    coordinates: sliceLine(direction.coordinates, direction.cumulativeM, board.alongM, alight.alongM),
    stopsBetween: direction.stops.filter((s) => s.alongM > board.alongM && s.alongM < alight.alongM),
  };
}

function walkLeg(from: LngLat, to: LngLat): WalkLeg {
  return {
    kind: 'walk',
    from: { lng: from.lng, lat: from.lat },
    to: { lng: to.lng, lat: to.lat },
    distanceM: haversineMetres(from, to),
  };
}

function toOption(legs: TripLeg[], cost: number): TripOption {
  const rides = legs.filter((leg): leg is RideLeg => leg.kind === 'ride');
  return {
    id: rides.map((r) => `${r.direction.id}@${Math.round(r.board.alongM)}`).join('>'),
    legs,
    transfers: rides.length - 1,
    walkM: legs.filter((l) => l.kind === 'walk').reduce((sum, l) => sum + l.distanceM, 0),
    rideM: rides.reduce((sum, r) => sum + r.distanceM, 0),
    cost,
  };
}

// ------------------------------------------------------------- the search

interface DirectCandidate {
  routeIndex: number;
  board: number;
  alight: number;
  cost: number;
}

function findDirect(
  network: TripNetwork,
  nearOrigin: Map<number, NearSample[]>,
  nearDestination: Map<number, NearSample[]>,
): DirectCandidate[] {
  const candidates: DirectCandidate[] = [];
  for (const [routeIndex, boards] of nearOrigin) {
    const alights = nearDestination.get(routeIndex);
    if (!alights) continue;
    const samples = network.routes[routeIndex]!.samples;
    let best: DirectCandidate | null = null;
    for (const b of boards) {
      for (const a of alights) {
        const rideM = samples[a.sampleIndex]!.alongM - samples[b.sampleIndex]!.alongM;
        // The destination must come AFTER the boarding point: jeepneys do not reverse.
        if (rideM < MIN_RIDE_M) continue;
        const cost = WALK_WEIGHT * (b.distanceM + a.distanceM) + rideM;
        if (!best || cost < best.cost) {
          best = { routeIndex, board: b.sampleIndex, alight: a.sampleIndex, cost };
        }
      }
    }
    if (best) candidates.push(best);
  }
  return candidates;
}

interface TransferCandidate {
  first: number;
  board: number;
  leave: number;
  second: number;
  join: number;
  alight: number;
  cost: number;
}

function findOneTransfer(
  network: TripNetwork,
  nearOrigin: Map<number, NearSample[]>,
  nearDestination: Map<number, NearSample[]>,
): TransferCandidate[] {
  /**
   * For the second route: at each sample, the cheapest place to get off at or
   * after it. Worked out once per route, back to front.
   */
  const bestAlightFrom = new Map<number, ({ index: number; value: number } | null)[]>();
  for (const [routeIndex, alights] of nearDestination) {
    const samples = network.routes[routeIndex]!.samples;
    const table: ({ index: number; value: number } | null)[] = new Array(samples.length).fill(null);
    const byIndex = new Map(alights.map((a) => [a.sampleIndex, a.distanceM]));
    let best: { index: number; value: number } | null = null;
    for (let i = samples.length - 1; i >= 0; i--) {
      const walk = byIndex.get(i);
      if (walk !== undefined) {
        const value = WALK_WEIGHT * walk + samples[i]!.alongM;
        if (!best || value < best.value) best = { index: i, value };
      }
      table[i] = best;
    }
    bestAlightFrom.set(routeIndex, table);
  }

  const bestPerPair = new Map<string, TransferCandidate>();

  for (const [first, boards] of nearOrigin) {
    const firstRoute = network.routes[first]!;
    const walkByIndex = new Map(boards.map((b) => [b.sampleIndex, b.distanceM]));
    // Walking forward along the first route, remember the cheapest place to have boarded.
    let bestBoard: { index: number; value: number } | null = null;

    firstRoute.samples.forEach((sample, leave) => {
      const walk = walkByIndex.get(leave);
      if (walk !== undefined) {
        const value = WALK_WEIGHT * walk - sample.alongM;
        if (!bestBoard || value < bestBoard.value) bestBoard = { index: leave, value };
      }
      if (!bestBoard) return;
      const boardSample = firstRoute.samples[bestBoard.index]!;
      if (sample.alongM - boardSample.alongM < MIN_RIDE_M) return;

      // Which other routes pass close to this point?
      for (const [second, joins] of samplesNear(network, sample, TRANSFER_RADIUS_M)) {
        if (second === first) continue;
        const secondRoute = network.routes[second]!;
        if (secondRoute.direction.code === firstRoute.direction.code) continue;
        const alightTable = bestAlightFrom.get(second);
        if (!alightTable) continue; // this route never reaches the destination

        for (const join of joins) {
          const alight = alightTable[join.sampleIndex];
          if (!alight) continue;
          const joinSample = secondRoute.samples[join.sampleIndex]!;
          const secondRideM = secondRoute.samples[alight.index]!.alongM - joinSample.alongM;
          if (secondRideM < MIN_RIDE_M) continue;

          const cost =
            bestBoard.value +
            sample.alongM + // = walk to board + first ride
            WALK_WEIGHT * join.distanceM +
            TRANSFER_PENALTY_M +
            (alight.value - joinSample.alongM); // = second ride + walk to destination

          const key = `${first}:${second}`;
          const known = bestPerPair.get(key);
          if (!known || cost < known.cost) {
            bestPerPair.set(key, {
              first,
              board: bestBoard.index,
              leave,
              second,
              join: join.sampleIndex,
              alight: alight.index,
              cost,
            });
          }
        }
      }
    });
  }
  return [...bestPerPair.values()];
}

/** Keeps the cheapest option for each sequence of jeepney codes. */
function bestPerCodeSequence(options: TripOption[]): TripOption[] {
  const best = new Map<string, TripOption>();
  for (const option of options) {
    const key = option.legs
      .filter((leg): leg is RideLeg => leg.kind === 'ride')
      .map((leg) => leg.direction.code)
      .join('>');
    const known = best.get(key);
    if (!known || option.cost < known.cost) best.set(key, option);
  }
  return [...best.values()];
}

export function findTrips(network: TripNetwork, origin: LngLat, destination: LngLat): TripResult {
  const straightLineM = haversineMetres(origin, destination);
  const none = (reason: NoTripReason): TripResult => ({ options: [], reason, straightLineM });

  if (straightLineM < WALKABLE_M) return none('too-close');

  const nearOrigin = samplesWithinWalk(network, origin);
  if (nearOrigin.size === 0) return none('origin-not-served');
  const nearDestination = samplesWithinWalk(network, destination);
  if (nearDestination.size === 0) return none('destination-not-served');

  const direct = findDirect(network, nearOrigin, nearDestination).map((c) => {
    const ride = rideLeg(network.routes[c.routeIndex]!, c.board, c.alight);
    return toOption([walkLeg(origin, ride.board), ride, walkLeg(ride.alight, destination)], c.cost);
  });

  const transfer = findOneTransfer(network, nearOrigin, nearDestination).map((c) => {
    const firstRide = rideLeg(network.routes[c.first]!, c.board, c.leave);
    const secondRide = rideLeg(network.routes[c.second]!, c.join, c.alight);
    return toOption(
      [
        walkLeg(origin, firstRide.board),
        firstRide,
        walkLeg(firstRide.alight, secondRide.board),
        secondRide,
        walkLeg(secondRide.alight, destination),
      ],
      c.cost,
    );
  });

  const options = bestPerCodeSequence([...direct, ...transfer])
    .sort((a, b) => a.transfers - b.transfers || a.cost - b.cost)
    .slice(0, MAX_OPTIONS);

  return { options, reason: options.length ? null : 'no-connection', straightLineM };
}
