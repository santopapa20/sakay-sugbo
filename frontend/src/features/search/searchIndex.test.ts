import { describe, expect, it } from 'vitest';
import type { Place, RouteDirection } from '../../types';
import { buildSearchIndex, search } from './searchIndex';

const place = (id: string, name: string, category: Place['category']): Place => ({
  id,
  name,
  category,
  address: null,
  lng: 123.9,
  lat: 10.3,
});

const route = (code: string, name: string, stopNames: string[]): RouteDirection => ({
  id: `r-${code}`,
  code,
  name,
  from: null,
  to: null,
  firstStopName: null,
  lastStopName: null,
  operator: null,
  network: null,
  colour: '#fff',
  lengthM: 1000,
  streets: [],
  stops: stopNames.map((stopName, i) => ({
    id: `stop-${stopName}`,
    name: stopName,
    lng: 123.9,
    lat: 10.3,
    alongM: i * 100,
  })),
  osmRelationId: 1,
  fieldVerified: false,
  coordinates: [
    [123.9, 10.3],
    [123.91, 10.3],
  ],
  cumulativeM: [0, 1000],
});

const index = buildSearchIndex(
  [
    place('1', 'Fuente Osmeña Circle', 'landmark'),
    place('2', 'Osmeña Boulevard', 'street'),
    place('3', 'Ayala Center Cebu', 'shopping'),
    place('4', 'Ayala Access Road', 'street'),
    place('5', 'SM City Cebu', 'shopping'),
  ],
  [
    route('13C', 'Talamban-Ayala-Colon', ['Colon Street', 'Ayala Terminal']),
    route('04L', 'Lahug-SM Cebu', ['Colon Street']),
  ],
);

const titles = (query: string) => search(index, query).map((r) => r.title);

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(search(index, '   ')).toEqual([]);
  });

  it('ignores accents and capital letters', () => {
    expect(titles('OSMENA')).toContain('Fuente Osmeña Circle');
    expect(titles('osmeña')).toContain('Osmeña Boulevard');
  });

  it('puts names that start with the query first', () => {
    expect(titles('osm')[0]).toBe('Osmeña Boulevard');
  });

  it('ranks a mall above a street of the same strength', () => {
    expect(titles('ayala')[0]).toBe('Ayala Center Cebu');
  });

  it('needs every typed word to match', () => {
    expect(titles('sm city')).toEqual(['SM City Cebu']);
    expect(titles('sm cebu')[0]).toBe('SM City Cebu');
    expect(titles('sm talamban')).not.toContain('SM City Cebu');
  });

  it('finds a route by its code and by its name', () => {
    const byCode = search(index, '13c')[0]!;
    expect(byCode.kind).toBe('route');
    expect(byCode.title).toBe('13C');
    expect(search(index, 'talamban').some((r) => r.kind === 'route' && r.title === '13C')).toBe(true);
  });

  it('lists a stop once even when two routes share it', () => {
    const stops = search(index, 'colon').filter((r) => r.kind === 'stop');
    expect(stops).toHaveLength(1);
    expect(stops[0]!.subtitle).toBe('Jeepney stop · 04L, 13C');
  });

  it('respects the limit', () => {
    expect(search(index, 'c', 2)).toHaveLength(2);
  });
});
