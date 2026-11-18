import { describe, expect, it } from 'vitest';
import { RECENT_TRIPS_STORAGE_KEY } from '../../config';
import type { TripPoint } from '../../types';
import { addRecentTrip, loadRecentTrips, saveRecentTrips, type RecentTrip } from './recentTrips';

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const point = (label: string, lng: number, lat: number, kind: TripPoint['kind'] = 'place'): TripPoint => ({
  label,
  lng,
  lat,
  kind,
});
const trip = (from: string, to: string, offset = 0): RecentTrip => ({
  origin: point(from, 123.9 + offset, 10.3),
  destination: point(to, 123.91 + offset, 10.32),
});

describe('recent trips', () => {
  it('puts the newest trip first', () => {
    const list = addRecentTrip(addRecentTrip([], trip('A', 'B')), trip('C', 'D', 0.01));
    expect(list.map((t) => t.origin.label)).toEqual(['C', 'A']);
  });

  it('moves a repeated trip to the top instead of listing it twice', () => {
    let list = addRecentTrip([], trip('A', 'B'));
    list = addRecentTrip(list, trip('C', 'D', 0.01));
    list = addRecentTrip(list, trip('A', 'B'));
    expect(list.map((t) => t.origin.label)).toEqual(['A', 'C']);
  });

  it('keeps only the five most recent', () => {
    let list: RecentTrip[] = [];
    for (let i = 0; i < 8; i++) list = addRecentTrip(list, trip(`From ${i}`, 'X', i * 0.01));
    expect(list).toHaveLength(5);
    expect(list[0]!.origin.label).toBe('From 7');
  });

  it('does not remember trips that start or end at "my location"', () => {
    const fromHere: RecentTrip = { origin: point('My location', 123.9, 10.3, 'me'), destination: point('B', 123.91, 10.32) };
    expect(addRecentTrip([], fromHere)).toEqual([]);
  });

  it('survives a save and a reload, and ignores damaged data', () => {
    const storage = fakeStorage();
    const list = addRecentTrip([], trip('A', 'B'));
    expect(saveRecentTrips(storage, list)).toBe(true);
    expect(loadRecentTrips(storage)).toEqual(list);
    expect(loadRecentTrips(fakeStorage({ [RECENT_TRIPS_STORAGE_KEY]: '{oops' }))).toEqual([]);
    expect(loadRecentTrips(fakeStorage({ [RECENT_TRIPS_STORAGE_KEY]: '[{"origin":1}]' }))).toEqual([]);
    expect(loadRecentTrips(undefined)).toEqual([]);
  });
});
