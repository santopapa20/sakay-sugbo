/**
 * Saving favourites in the browser's local storage, so they are still there
 * after a reload. Nothing is sent anywhere.
 *
 * The storage object is passed in rather than used directly, which lets the
 * tests run without a browser and lets the app survive private-browsing
 * modes where local storage throws.
 */
import { FAVOURITES_STORAGE_KEY } from '../../config';
import type { Place } from '../../types';

export interface Favourites {
  /** Saved jeepney codes, e.g. ["13C", "04L"]. */
  routeCodes: string[];
  /** Saved places, stored whole so they still show if the data changes. */
  places: Place[];
}

export const EMPTY_FAVOURITES: Favourites = { routeCodes: [], places: [] };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.lng === 'number' &&
    typeof p.lat === 'number'
  );
}

/** Reads favourites, falling back to "none" if the stored text is missing or damaged. */
export function loadFavourites(storage: StorageLike | undefined): Favourites {
  try {
    const raw = storage?.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return EMPTY_FAVOURITES;
    const parsed = JSON.parse(raw) as Partial<Favourites>;
    return {
      routeCodes: Array.isArray(parsed.routeCodes)
        ? parsed.routeCodes.filter((code): code is string => typeof code === 'string')
        : [],
      places: Array.isArray(parsed.places) ? parsed.places.filter(isPlace) : [],
    };
  } catch {
    return EMPTY_FAVOURITES;
  }
}

/** Returns false when the browser refused to save (storage full or disabled). */
export function saveFavourites(storage: StorageLike | undefined, favourites: Favourites): boolean {
  try {
    if (!storage) return false;
    storage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favourites));
    return true;
  } catch {
    return false;
  }
}

export function toggleRouteCode(favourites: Favourites, code: string): Favourites {
  const saved = favourites.routeCodes.includes(code);
  return {
    ...favourites,
    routeCodes: saved
      ? favourites.routeCodes.filter((c) => c !== code)
      : [...favourites.routeCodes, code].sort(),
  };
}

export function togglePlace(favourites: Favourites, place: Place): Favourites {
  const saved = favourites.places.some((p) => p.id === place.id);
  return {
    ...favourites,
    places: saved ? favourites.places.filter((p) => p.id !== place.id) : [...favourites.places, place],
  };
}
