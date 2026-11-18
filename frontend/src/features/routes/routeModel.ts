/**
 * Questions we ask about routes: where does it start, which streets does it
 * use, which routes pass near this point? Pure functions, no React, no map.
 */
import type { LngLat, RouteDirection, RouteGroup, RouteStop } from '../../types';
import { haversineMetres, indexAtDistance, nearestOnLine } from '../../utils/geo';

/**
 * Where this direction starts, using the best information OpenStreetMap has.
 *
 * Normally that is the "from" terminal a mapper recorded. But a few routes
 * have the same from/to written on both directions (a mistake in the map
 * data). For those the recorded terminals cannot tell the directions apart,
 * so we use the name of the first stop on the line instead, which always
 * matches the way the line is actually drawn.
 */
export function originLabel(direction: RouteDirection): string {
  if (direction.terminalsAmbiguous) {
    return direction.firstStopName ?? direction.from ?? 'Start not recorded';
  }
  return direction.from ?? direction.firstStopName ?? 'Start not recorded';
}

/** Where this direction ends. See originLabel for the rule. */
export function destinationLabel(direction: RouteDirection): string {
  if (direction.terminalsAmbiguous) {
    return direction.lastStopName ?? direction.to ?? 'End not recorded';
  }
  return direction.to ?? direction.lastStopName ?? 'End not recorded';
}

/**
 * Marks directions whose recorded terminals are identical to another
 * direction of the same code. Returns new objects; the input is not changed.
 */
export function flagAmbiguousTerminals<T extends Pick<RouteDirection, 'code' | 'from' | 'to'>>(
  directions: T[],
): (T & { terminalsAmbiguous: boolean })[] {
  const count = new Map<string, number>();
  const key = (d: T) => `${d.code}|${d.from}|${d.to}`;
  for (const direction of directions) count.set(key(direction), (count.get(key(direction)) ?? 0) + 1);
  return directions.map((direction) => ({
    ...direction,
    terminalsAmbiguous: (count.get(key(direction)) ?? 0) > 1,
  }));
}

/** Directions sharing a code, sorted the way jeepney codes are read: 01B, 01C, 03A ... */
export function groupRoutes(directions: RouteDirection[]): RouteGroup[] {
  const groups = new Map<string, RouteGroup>();
  for (const direction of directions) {
    const group = groups.get(direction.code) ?? {
      code: direction.code,
      colour: direction.colour,
      directions: [],
    };
    group.directions.push(direction);
    groups.set(direction.code, group);
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** The street the route is on at a given distance from its start, if it has a name. */
export function streetAt(direction: RouteDirection, alongM: number): string | null {
  const index = indexAtDistance(direction.cumulativeM, alongM);
  let name: string | null = null;
  for (const stretch of direction.streets) {
    if (stretch.fromIndex > index) break;
    name = stretch.name;
  }
  return name;
}

/**
 * The main named streets the route uses, in the order it drives them.
 * "Main" means the longest stretches, so short connecting lanes are left out.
 */
export function viaStreets(direction: RouteDirection, limit = 5): string[] {
  const lengthByStreet = new Map<string, number>();
  const firstSeen = new Map<string, number>();

  direction.streets.forEach((stretch, i) => {
    if (!stretch.name) return;
    const next = direction.streets[i + 1];
    const endIndex = next ? next.fromIndex : direction.cumulativeM.length - 1;
    const length = direction.cumulativeM[endIndex]! - direction.cumulativeM[stretch.fromIndex]!;
    lengthByStreet.set(stretch.name, (lengthByStreet.get(stretch.name) ?? 0) + length);
    if (!firstSeen.has(stretch.name)) firstSeen.set(stretch.name, stretch.fromIndex);
  });

  return [...lengthByStreet.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name)
    .sort((a, b) => firstSeen.get(a)! - firstSeen.get(b)!);
}

export interface NearbyRoute {
  direction: RouteDirection;
  /** Metres from the point to the closest part of the route. */
  distanceM: number;
  /** Where on the route that closest part is. */
  alongM: number;
}

/**
 * Every route direction that passes within `radiusM` of a point, nearest first.
 * This is the same job the backend's `GET /api/routes/near` will do.
 */
export function routesNear(
  directions: RouteDirection[],
  point: LngLat,
  radiusM: number,
): NearbyRoute[] {
  const found: NearbyRoute[] = [];
  for (const direction of directions) {
    const nearest = nearestOnLine(point, direction.coordinates, direction.cumulativeM);
    if (nearest && nearest.distanceM <= radiusM) {
      found.push({ direction, distanceM: nearest.distanceM, alongM: nearest.alongM });
    }
  }
  return found.sort((a, b) => a.distanceM - b.distanceM);
}

/** Another route that can be boarded at, or close to, a given stop. */
export interface StopConnection {
  direction: RouteDirection;
  /** That route's own stop here (it may be across the street). */
  stop: RouteStop;
  /** Metres between the two stops; 0 when it is the very same stop. */
  distanceM: number;
}

/**
 * The other routes you could change to at a stop: every direction of a
 * different code that has a stop within `radiusM` metres. Sorted by code.
 * The trip finder uses the same distance to decide where a change is possible.
 */
export function routesAtStop(
  directions: RouteDirection[],
  stop: RouteStop,
  exceptCode: string,
  radiusM: number,
): StopConnection[] {
  const found: StopConnection[] = [];
  for (const direction of directions) {
    if (direction.code === exceptCode) continue;
    let best: StopConnection | null = null;
    for (const candidate of direction.stops) {
      const distanceM = candidate.id === stop.id ? 0 : haversineMetres(stop, candidate);
      if (distanceM <= radiusM && (!best || distanceM < best.distanceM)) {
        best = { direction, stop: candidate, distanceM };
      }
    }
    if (best) found.push(best);
  }
  return found.sort(
    (a, b) => a.direction.code.localeCompare(b.direction.code) || a.distanceM - b.distanceM,
  );
}
