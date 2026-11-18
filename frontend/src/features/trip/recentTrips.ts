/**
 * Remembering the last few trips searched, in the browser's local storage,
 * so a regular commute is one tap away. Nothing is sent anywhere.
 *
 * Same approach as favouritesStorage.ts: the storage object is passed in, so
 * the tests need no browser and a browser that refuses storage cannot crash the app.
 */
import { RECENT_TRIPS_STORAGE_KEY } from '../../config';
import type { TripPoint } from '../../types';

export interface RecentTrip {
  origin: TripPoint;
  destination: TripPoint;
}

const MAX_RECENT = 5;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isTripPoint(value: unknown): value is TripPoint {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.label === 'string' && typeof p.lng === 'number' && typeof p.lat === 'number';
}

/** Two trips are "the same" when both ends are within about ten metres. */
const key = ({ origin, destination }: RecentTrip) =>
  [origin.lat, origin.lng, destination.lat, destination.lng].map((n) => n.toFixed(4)).join('|');

/** A new list with `trip` first. The input list is not changed. */
export function addRecentTrip(list: RecentTrip[], trip: RecentTrip): RecentTrip[] {
  // "My location" is wherever you were at the time, so it is not worth
  // repeating, and it should not be kept on the device afterwards.
  if (trip.origin.kind === 'me' || trip.destination.kind === 'me') return list;
  return [trip, ...list.filter((known) => key(known) !== key(trip))].slice(0, MAX_RECENT);
}

export function loadRecentTrips(storage: StorageLike | undefined): RecentTrip[] {
  try {
    const raw = storage?.getItem(RECENT_TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentTrip => isTripPoint(item?.origin) && isTripPoint(item?.destination))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Returns false when the browser refused to save. */
export function saveRecentTrips(storage: StorageLike | undefined, list: RecentTrip[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(RECENT_TRIPS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
