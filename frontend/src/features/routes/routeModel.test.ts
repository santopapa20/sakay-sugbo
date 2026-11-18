import { describe, expect, it } from 'vitest';
import type { Coordinate, RouteDirection } from '../../types';
import { cumulativeMetres } from '../../utils/geo';
import {
  destinationLabel,
  flagAmbiguousTerminals,
  groupRoutes,
  originLabel,
  routesNear,
  streetAt,
  viaStreets,
} from './routeModel';

/** A made-up route for testing. NOT a real Cebu route. */
function route(overrides: Partial<RouteDirection> = {}): RouteDirection {
  // West → east along latitude 10.300: three points, about 1.1 km each.
  const coordinates: Coordinate[] = [
    [123.88, 10.3],
    [123.89, 10.3],
    [123.9, 10.3],
    [123.91, 10.3],
  ];
  return {
    id: 'r1',
    code: '99Z',
    name: 'Test route',
    from: 'West',
    to: 'East',
    firstStopName: 'West Gate',
    lastStopName: 'East Gate',
    operator: null,
    network: null,
    colour: '#fff',
    lengthM: 3300,
    streets: [
      { name: 'First Street', fromIndex: 0 },
      { name: null, fromIndex: 1 },
      { name: 'Third Street', fromIndex: 2 },
    ],
    stops: [
      { id: 'a', name: 'West Gate', lng: 123.88, lat: 10.3, alongM: 0 },
      { id: 'b', name: 'Middle', lng: 123.895, lat: 10.3, alongM: 1640 },
      { id: 'c', name: 'East Gate', lng: 123.91, lat: 10.3, alongM: 3280 },
    ],
    osmRelationId: 1,
    fieldVerified: false,
    coordinates,
    cumulativeM: cumulativeMetres(coordinates),
    ...overrides,
  };
}

describe('terminal labels', () => {
  it('uses the recorded terminals when they exist', () => {
    expect(originLabel(route())).toBe('West');
    expect(destinationLabel(route())).toBe('East');
  });

  it('falls back to the first and last stop when no terminal is recorded', () => {
    const untagged = route({ from: null, to: null });
    expect(originLabel(untagged)).toBe('West Gate');
    expect(destinationLabel(untagged)).toBe('East Gate');
  });

  it('says so when nothing at all is known', () => {
    const blank = route({ from: null, to: null, firstStopName: null, lastStopName: null });
    expect(originLabel(blank)).toBe('Start not recorded');
    expect(destinationLabel(blank)).toBe('End not recorded');
  });

  it('prefers stop names when two directions carry the same terminals', () => {
    const [there, back, other] = flagAmbiguousTerminals([
      route({ id: 'there' }),
      route({ id: 'back', firstStopName: 'East Gate', lastStopName: 'West Gate' }),
      route({ id: 'other', code: '98Y' }),
    ]);
    expect(there!.terminalsAmbiguous).toBe(true);
    expect(destinationLabel(there!)).toBe('East Gate');
    expect(destinationLabel(back!)).toBe('West Gate');
    // A different code with the same names is not a clash.
    expect(other!.terminalsAmbiguous).toBe(false);
    expect(destinationLabel(other!)).toBe('East');
  });
});

describe('groupRoutes', () => {
  it('groups directions by code and sorts the codes', () => {
    const groups = groupRoutes([
      route({ id: '1', code: '13C' }),
      route({ id: '2', code: '04L' }),
      route({ id: '3', code: '13C' }),
    ]);
    expect(groups.map((g) => g.code)).toEqual(['04L', '13C']);
    expect(groups[1]!.directions.map((d) => d.id)).toEqual(['1', '3']);
  });
});

describe('streets', () => {
  it('names the street at a distance along the route', () => {
    expect(streetAt(route(), 100)).toBe('First Street');
    expect(streetAt(route(), 1500)).toBeNull(); // an unnamed stretch
    expect(streetAt(route(), 3000)).toBe('Third Street');
  });

  it('lists named streets in travel order, skipping unnamed stretches', () => {
    expect(viaStreets(route())).toEqual(['First Street', 'Third Street']);
    expect(viaStreets(route(), 1)).toHaveLength(1);
  });
});

describe('routesNear', () => {
  const routes = [
    route({ id: 'close' }),
    route({
      id: 'far',
      coordinates: [
        [123.88, 10.35],
        [123.91, 10.35],
      ],
      cumulativeM: cumulativeMetres([
        [123.88, 10.35],
        [123.91, 10.35],
      ]),
    }),
  ];

  it('returns only routes within the radius', () => {
    // About 110 m north of the first route.
    const found = routesNear(routes, { lng: 123.895, lat: 10.301 }, 300);
    expect(found.map((f) => f.direction.id)).toEqual(['close']);
    expect(found[0]!.distanceM).toBeGreaterThan(100);
    expect(found[0]!.distanceM).toBeLessThan(120);
  });

  it('respects a smaller radius', () => {
    expect(routesNear(routes, { lng: 123.895, lat: 10.301 }, 50)).toEqual([]);
  });

  it('sorts nearest first', () => {
    const both = routesNear(routes, { lng: 123.895, lat: 10.33 }, 5000);
    expect(both.map((f) => f.direction.id)).toEqual(['far', 'close']);
  });
});
