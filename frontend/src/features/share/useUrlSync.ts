import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { decodeUrlState, encodeUrlState, type UrlState } from './urlState';

type AppState = ReturnType<typeof useAppStore.getState>;

/** What the address should say for the app's current state. */
function currentUrlState(state: AppState): UrlState {
  if (state.selectedRouteId) {
    return state.selectedStopId
      ? { kind: 'route', routeId: state.selectedRouteId, stopId: state.selectedStopId }
      : { kind: 'route', routeId: state.selectedRouteId };
  }
  if (state.tab === 'trip' && (state.tripOrigin || state.tripDestination)) {
    return { kind: 'trip', origin: state.tripOrigin, destination: state.tripDestination };
  }
  if (state.tab === 'explore' && state.focus) {
    const { focus } = state;
    if (focus.kind === 'point') return { kind: 'point', point: focus.point };
    // A stop found through search is shown like a place but is not in the
    // place list, so it is shared by its position instead of by an id.
    return state.places.some((place) => place.id === focus.place.id)
      ? { kind: 'place', placeId: focus.place.id }
      : { kind: 'point', point: focus.place };
  }
  return null;
}

/** Opens whatever a link points at. Unknown ids are ignored, never guessed. */
function applyUrlState(urlState: UrlState) {
  const state = useAppStore.getState();
  switch (urlState?.kind) {
    case 'route': {
      const route = state.routeById.get(urlState.routeId);
      if (!route) return;
      state.selectRoute(route.id);
      if (urlState.stopId && route.stops.some((stop) => stop.id === urlState.stopId)) {
        state.selectStop(urlState.stopId);
      }
      return;
    }
    case 'trip':
      state.setTrip(urlState.origin, urlState.destination);
      return;
    case 'place': {
      const place = state.places.find((p) => p.id === urlState.placeId);
      if (place) state.focusPlace(place);
      return;
    }
    case 'point':
      state.focusPoint(urlState.point);
      return;
  }
}

/**
 * Keeps the web address and the app in step, in both directions:
 *  - opening a link (or editing the address) opens that route, trip or place;
 *  - choosing something in the app updates the address, so it can be copied.
 *
 * The address is updated with `replaceState`, which does not add an entry to
 * the browser's history: the Back button still leaves the app in one press.
 */
export function useUrlSync() {
  const ready = useAppStore((state) => state.dataStatus === 'ready');

  useEffect(() => {
    if (!ready) return;

    const readAddress = () => applyUrlState(decodeUrlState(window.location.hash));
    readAddress();

    let lastWritten: string | null = null;
    const writeAddress = (state: AppState) => {
      const hash = encodeUrlState(currentUrlState(state));
      if (hash === lastWritten) return; // most state changes (a toast, a tab) do not touch the address
      lastWritten = hash;
      if (window.location.hash.replace(/^#/, '') === hash) return;
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', hash ? `#${hash}` : pathname + search);
    };
    writeAddress(useAppStore.getState());
    const stopWatching = useAppStore.subscribe(writeAddress);

    // Fires when the person edits the address by hand or pastes a new link.
    window.addEventListener('hashchange', readAddress);
    return () => {
      stopWatching();
      window.removeEventListener('hashchange', readAddress);
    };
  }, [ready]);
}
