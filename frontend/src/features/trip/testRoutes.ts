/**
 * Made-up routes used only by the unit tests. They are simple straight lines
 * so that the expected answers are easy to work out by hand.
 * These are NOT real Cebu routes and are never shown in the app.
 */
import type { Coordinate, RouteDirection, RouteStop } from '../../types';
import { cumulativeMetres, sliceLine } from '../../utils/geo';

/** Puts a stop every `spacingM` metres along a line, starting at its first point. */
function stopsEvery(code: string, coordinates: Coordinate[], spacingM: number): RouteStop[] {
  const cumulative = cumulativeMetres(coordinates);
  const total = cumulative.at(-1)!;
  const stops: RouteStop[] = [];
  for (let alongM = 0, n = 1; alongM <= total; alongM += spacingM, n++) {
    const [lng, lat] = sliceLine(coordinates, cumulative, alongM, alongM)[0]!;
    stops.push({ id: `${code}-stop-${n}`, name: `${code} stop ${n}`, lng, lat, alongM });
  }
  return stops;
}

export function makeTestRoute(
  code: string,
  coordinates: Coordinate[],
  overrides: Partial<RouteDirection> = {},
): RouteDirection {
  const cumulativeM = cumulativeMetres(coordinates);
  return {
    id: code,
    code,
    name: null,
    from: null,
    to: `${code} Terminal`,
    firstStopName: null,
    lastStopName: null,
    operator: null,
    network: null,
    colour: '#ffffff',
    lengthM: Math.round(cumulativeM.at(-1)!),
    streets: [{ name: `${code} Street`, fromIndex: 0 }],
    stops: stopsEvery(code, coordinates, 250),
    osmRelationId: 0,
    fieldVerified: false,
    coordinates,
    cumulativeM,
    ...overrides,
  };
}

/** Runs west → east along latitude 10.300, about 4.4 km. */
export const EAST = makeTestRoute('EAST', [
  [123.88, 10.3],
  [123.92, 10.3],
]);

/** Runs south → north along longitude 123.900, crossing EAST at (123.900, 10.300). */
export const NORTH = makeTestRoute('NORTH', [
  [123.9, 10.29],
  [123.9, 10.33],
]);
