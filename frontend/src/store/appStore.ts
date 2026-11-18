/**
 * The app's shared state, in one store (Zustand).
 *
 * Components read the pieces they need with `useAppStore(state => state.x)`
 * and call the actions below to change things. Keeping the rules here ("when
 * a route is selected, forget the selected stop") means the map and the
 * panels can never disagree about what is selected.
 */
import { create } from 'zustand';
import { MAP_BOUNDS } from '../config';
import {
  loadFavourites,
  saveFavourites,
  togglePlace,
  toggleRouteCode,
  type Favourites,
} from '../features/favorites/favouritesStorage';
import { groupRoutes } from '../features/routes/routeModel';
import { buildSearchIndex, type SearchIndex } from '../features/search/searchIndex';
import { buildTripNetwork, type TripNetwork, type TripResult } from '../features/trip/tripPlanner';
import { dataService } from '../services/dataService';
import { planTrip } from '../services/tripService';
import type {
  DataMeta,
  LngLat,
  Place,
  PlaceCategory,
  RouteDirection,
  RouteGroup,
  TripPoint,
} from '../types';

export type Tab = 'explore' | 'trip' | 'routes' | 'saved';
export type SheetSnap = 'peek' | 'half' | 'full';
export type TripEnd = 'origin' | 'destination';

/** What the Explore tab is looking at: a known place, or a spot the user tapped. */
export type Focus = { kind: 'place'; place: Place } | { kind: 'point'; point: LngLat } | null;

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

/** What was under the finger when the map was tapped, if anything. */
export type MapHit = { kind: 'stop'; id: string } | { kind: 'place'; id: string } | null;

interface AppState {
  // ---- data
  dataStatus: 'loading' | 'ready' | 'error';
  dataError: string | null;
  routes: RouteDirection[];
  routeById: Map<string, RouteDirection>;
  groups: RouteGroup[];
  places: Place[];
  meta: DataMeta | null;
  searchIndex: SearchIndex | null;
  tripNetwork: TripNetwork | null;

  // ---- what is on screen
  tab: Tab;
  sheet: SheetSnap;
  selectedRouteId: string | null;
  selectedStopId: string | null;
  focus: Focus;
  activeCategory: PlaceCategory | null;
  aboutOpen: boolean;

  // ---- trip finder
  tripOrigin: TripPoint | null;
  tripDestination: TripPoint | null;
  tripStatus: 'idle' | 'searching' | 'done';
  tripResult: TripResult | null;
  tripSelected: number;
  /** Set while the next map tap should choose the start or the destination. */
  picking: TripEnd | null;

  // ---- the user
  userLocation: (LngLat & { accuracyM: number }) | null;
  locating: boolean;
  favourites: Favourites;
  toasts: Toast[];

  // ---- actions
  loadData: () => Promise<void>;
  setTab: (tab: Tab) => void;
  setSheet: (sheet: SheetSnap) => void;
  selectRoute: (id: string | null) => void;
  selectStop: (id: string | null) => void;
  focusPlace: (place: Place) => void;
  clearFocus: () => void;
  setCategory: (category: PlaceCategory | null) => void;
  setAboutOpen: (open: boolean) => void;
  setTripPoint: (end: TripEnd, point: TripPoint | null) => void;
  swapTrip: () => void;
  selectTripOption: (index: number) => void;
  setPicking: (end: TripEnd | null) => void;
  handleMapClick: (point: LngLat, hit: MapHit) => void;
  locateUser: () => Promise<TripPoint | null>;
  toggleFavouriteRoute: (code: string) => void;
  toggleFavouritePlace: (place: Place) => void;
  showToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const storage = typeof window === 'undefined' ? undefined : window.localStorage;
let nextToastId = 1;
/** Counts trip searches so that a slow, outdated answer can be ignored. */
let tripRequest = 0;

const insideCoverage = ({ lng, lat }: LngLat) =>
  lng >= MAP_BOUNDS[0][0] && lng <= MAP_BOUNDS[1][0] && lat >= MAP_BOUNDS[0][1] && lat <= MAP_BOUNDS[1][1];

const pinLabel = ({ lng, lat }: LngLat) => `Pinned point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

export const useAppStore = create<AppState>((set, get) => {
  /** Runs the trip search whenever both ends are known. */
  const refreshTrip = async () => {
    const { tripOrigin, tripDestination, tripNetwork } = get();
    const request = ++tripRequest;
    if (!tripOrigin || !tripDestination || !tripNetwork) {
      set({ tripStatus: 'idle', tripResult: null, tripSelected: 0 });
      return;
    }
    set({ tripStatus: 'searching' });
    const result = await planTrip(tripNetwork, tripOrigin, tripDestination);
    if (request !== tripRequest) return; // the user has already changed the question
    set({ tripStatus: 'done', tripResult: result, tripSelected: 0, sheet: 'half' });
  };

  const persistFavourites = (favourites: Favourites) => {
    set({ favourites });
    if (!saveFavourites(storage, favourites)) {
      get().showToast('Saved for now, but this browser will not remember it after a reload.', 'warning');
    }
  };

  return {
    dataStatus: 'loading',
    dataError: null,
    routes: [],
    routeById: new Map(),
    groups: [],
    places: [],
    meta: null,
    searchIndex: null,
    tripNetwork: null,

    tab: 'explore',
    sheet: 'peek',
    selectedRouteId: null,
    selectedStopId: null,
    focus: null,
    activeCategory: null,
    aboutOpen: false,

    tripOrigin: null,
    tripDestination: null,
    tripStatus: 'idle',
    tripResult: null,
    tripSelected: 0,
    picking: null,

    userLocation: null,
    locating: false,
    favourites: loadFavourites(storage),
    toasts: [],

    loadData: async () => {
      set({ dataStatus: 'loading', dataError: null });
      try {
        const [routes, places, meta] = await Promise.all([
          dataService.getRoutes(),
          dataService.getPlaces(),
          dataService.getMeta(),
        ]);
        set({
          dataStatus: 'ready',
          routes,
          routeById: new Map(routes.map((route) => [route.id, route])),
          groups: groupRoutes(routes),
          places,
          meta,
          searchIndex: buildSearchIndex(places, routes),
          tripNetwork: buildTripNetwork(routes),
        });
      } catch (error) {
        set({
          dataStatus: 'error',
          dataError: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },

    setTab: (tab) => set({ tab, selectedRouteId: null, selectedStopId: null, picking: null, sheet: 'half' }),
    setSheet: (sheet) => set({ sheet }),

    selectRoute: (id) => set({ selectedRouteId: id, selectedStopId: null, picking: null, sheet: 'half' }),
    selectStop: (id) => set({ selectedStopId: id }),

    focusPlace: (place) =>
      set({
        focus: { kind: 'place', place },
        tab: 'explore',
        selectedRouteId: null,
        selectedStopId: null,
        sheet: 'half',
      }),
    clearFocus: () => set({ focus: null }),

    setCategory: (category) => set({ activeCategory: category }),
    setAboutOpen: (open) => set({ aboutOpen: open }),

    setTripPoint: (end, point) => {
      set(end === 'origin' ? { tripOrigin: point } : { tripDestination: point });
      set({ tab: 'trip', selectedRouteId: null, selectedStopId: null, picking: null, sheet: 'half' });
      void refreshTrip();
    },

    swapTrip: () => {
      const { tripOrigin, tripDestination } = get();
      set({ tripOrigin: tripDestination, tripDestination: tripOrigin });
      void refreshTrip();
    },

    selectTripOption: (index) => set({ tripSelected: index }),

    setPicking: (end) => set({ picking: end, sheet: end ? 'peek' : get().sheet }),

    handleMapClick: (point, hit) => {
      const state = get();
      const hitPlace = hit?.kind === 'place' ? state.places.find((p) => p.id === hit.id) : undefined;
      const asTripPoint = (): TripPoint =>
        hitPlace
          ? { lng: hitPlace.lng, lat: hitPlace.lat, label: hitPlace.name, kind: 'place' }
          : { ...point, label: pinLabel(point), kind: 'pin' };

      // 1. The user was asked to pick a trip end on the map.
      if (state.picking) {
        state.setTripPoint(state.picking, asTripPoint());
        return;
      }
      // 2. A stop of the selected route was tapped.
      if (hit?.kind === 'stop') {
        set({ selectedStopId: hit.id });
        return;
      }
      // 3. While a route is open, a stray tap should not throw it away.
      if (state.selectedRouteId) return;
      // 4. In the trip tab, taps fill in whichever end is still empty.
      if (state.tab === 'trip') {
        if (!state.tripOrigin) state.setTripPoint('origin', asTripPoint());
        else if (!state.tripDestination) state.setTripPoint('destination', asTripPoint());
        return;
      }
      // 5. Otherwise: "what passes here?"
      set({
        tab: 'explore',
        focus: hitPlace ? { kind: 'place', place: hitPlace } : { kind: 'point', point },
        sheet: 'half',
      });
    },

    locateUser: () => {
      const { showToast } = get();
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        showToast('This browser cannot share your location. You can tap the map instead.', 'warning');
        return Promise.resolve(null);
      }
      set({ locating: true });
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const here = { lng: position.coords.longitude, lat: position.coords.latitude };
            set({ locating: false, userLocation: { ...here, accuracyM: position.coords.accuracy } });
            if (!insideCoverage(here)) {
              showToast('You seem to be outside Metro Cebu, so the map stays where it is.', 'info');
            }
            resolve({ ...here, label: 'My location', kind: 'me' });
          },
          (error) => {
            set({ locating: false });
            const message =
              error.code === error.PERMISSION_DENIED
                ? 'Location permission was denied. You can still tap the map or search for a place.'
                : error.code === error.TIMEOUT
                  ? 'Finding your location took too long. Try again, or tap the map.'
                  : 'Your location is not available right now. You can tap the map instead.';
            showToast(message, 'warning');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
        );
      });
    },

    toggleFavouriteRoute: (code) => {
      const before = get().favourites;
      const after = toggleRouteCode(before, code);
      persistFavourites(after);
      get().showToast(
        after.routeCodes.includes(code) ? `Saved route ${code}` : `Removed route ${code}`,
        'success',
      );
    },

    toggleFavouritePlace: (place) => {
      const after = togglePlace(get().favourites, place);
      persistFavourites(after);
      get().showToast(
        after.places.some((p) => p.id === place.id) ? `Saved ${place.name}` : `Removed ${place.name}`,
        'success',
      );
    },

    showToast: (message, tone = 'info') => {
      const id = nextToastId++;
      // Keep at most two on screen so they never pile up over the map.
      set({ toasts: [...get().toasts.slice(-1), { id, message, tone }] });
      window.setTimeout(() => get().dismissToast(id), 5000);
    },

    dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  };
});

/**
 * A short text that changes whenever the panel shows something different.
 * The panel uses it to scroll back to the top, so a new view never opens half-way down.
 */
export const useViewKey = () =>
  useAppStore((state) => {
    const focus = state.focus;
    const focusKey = !focus
      ? ''
      : focus.kind === 'place'
        ? focus.place.id
        : `${focus.point.lng},${focus.point.lat}`;
    return `${state.tab}|${state.selectedRouteId ?? ''}|${focusKey}`;
  });

/** The route direction currently open, or null. */
export const useSelectedRoute = () =>
  useAppStore((state) =>
    state.selectedRouteId ? (state.routeById.get(state.selectedRouteId) ?? null) : null,
  );
