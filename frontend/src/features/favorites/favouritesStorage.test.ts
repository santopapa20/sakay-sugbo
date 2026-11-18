import { describe, expect, it } from 'vitest';
import { FAVOURITES_STORAGE_KEY } from '../../config';
import type { Place } from '../../types';
import {
  EMPTY_FAVOURITES,
  loadFavourites,
  saveFavourites,
  togglePlace,
  toggleRouteCode,
} from './favouritesStorage';

/** A stand-in for the browser's localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const AYALA: Place = {
  id: 'p1',
  name: 'Ayala Center Cebu',
  category: 'shopping',
  address: null,
  lng: 123.9054,
  lat: 10.3181,
};

describe('favourites storage', () => {
  it('starts empty', () => {
    expect(loadFavourites(fakeStorage())).toEqual(EMPTY_FAVOURITES);
  });

  it('survives a save and a reload', () => {
    const storage = fakeStorage();
    const favourites = togglePlace(toggleRouteCode(EMPTY_FAVOURITES, '13C'), AYALA);
    expect(saveFavourites(storage, favourites)).toBe(true);
    expect(loadFavourites(storage)).toEqual({ routeCodes: ['13C'], places: [AYALA] });
  });

  it('ignores damaged stored text instead of crashing', () => {
    expect(loadFavourites(fakeStorage({ [FAVOURITES_STORAGE_KEY]: '{not json' }))).toEqual(
      EMPTY_FAVOURITES,
    );
  });

  it('drops entries of the wrong shape', () => {
    const stored = JSON.stringify({ routeCodes: ['04L', 7], places: [AYALA, { id: 'broken' }] });
    expect(loadFavourites(fakeStorage({ [FAVOURITES_STORAGE_KEY]: stored }))).toEqual({
      routeCodes: ['04L'],
      places: [AYALA],
    });
  });

  it('reports failure when the browser refuses to save', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveFavourites(full, EMPTY_FAVOURITES)).toBe(false);
    expect(saveFavourites(undefined, EMPTY_FAVOURITES)).toBe(false);
  });
});

describe('toggling', () => {
  it('adds a route code, keeps codes sorted, and removes on second toggle', () => {
    const one = toggleRouteCode(toggleRouteCode(EMPTY_FAVOURITES, '13C'), '04L');
    expect(one.routeCodes).toEqual(['04L', '13C']);
    expect(toggleRouteCode(one, '13C').routeCodes).toEqual(['04L']);
  });

  it('adds and removes a place by id', () => {
    const saved = togglePlace(EMPTY_FAVOURITES, AYALA);
    expect(saved.places).toEqual([AYALA]);
    expect(togglePlace(saved, { ...AYALA }).places).toEqual([]);
  });
});
