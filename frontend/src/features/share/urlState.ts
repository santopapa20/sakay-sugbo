/**
 * Turning "what is on screen" into the part of a web address after the #,
 * and back again. This is what makes a link shareable: open
 *   .../#route=osm-21251275
 * and the app opens that route.
 *
 * The # part of an address is never sent to a server, so this works on any
 * static host, GitHub Pages included.
 *
 * Pure functions with no browser or React in them, so they are easy to test.
 */
import type { LngLat, TripPoint } from '../../types';

export type UrlState =
  | { kind: 'route'; routeId: string; stopId?: string }
  | { kind: 'trip'; origin: TripPoint | null; destination: TripPoint | null }
  | { kind: 'place'; placeId: string }
  | { kind: 'point'; point: LngLat }
  | null;

/** Five decimal places is about one metre: plenty, and it keeps links short. */
const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

const encodePoint = ({ lat, lng }: LngLat) => `${round5(lat)},${round5(lng)}`;

/** "10.3,123.9" (and anything after a second comma is ignored here). */
function decodePoint(text: string | null): LngLat | null {
  if (!text) return null;
  const [latText, lngText] = text.split(',');
  // Number('') is 0, so empty pieces are rejected before converting.
  if (!latText || !lngText) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function encodeTripPoint(point: TripPoint): string {
  // "My location" means something different to whoever opens the link.
  const label = point.kind === 'me' ? 'Shared location' : point.label;
  return `${encodePoint(point)},${label}`;
}

function decodeTripPoint(text: string | null): TripPoint | null {
  const position = decodePoint(text);
  if (!position || !text) return null;
  // The label is everything after the second comma, so it may contain commas itself.
  const label = text.split(',').slice(2).join(',').trim();
  return { ...position, label: label || 'Shared point', kind: 'pin' };
}

/** The text to put after the # in the address. Empty when nothing is open. */
export function encodeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  switch (state?.kind) {
    case 'route':
      params.set('route', state.routeId);
      if (state.stopId) params.set('stop', state.stopId);
      break;
    case 'trip':
      if (state.origin) params.set('from', encodeTripPoint(state.origin));
      if (state.destination) params.set('to', encodeTripPoint(state.destination));
      break;
    case 'place':
      params.set('place', state.placeId);
      break;
    case 'point':
      params.set('at', encodePoint(state.point));
      break;
  }
  // Commas are allowed in this part of an address; leaving them readable keeps links short.
  return params.toString().replace(/%2C/g, ',');
}

/** Reads the # part of an address. Anything damaged or unknown gives null. */
export function decodeUrlState(hash: string): UrlState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  const routeId = params.get('route');
  if (routeId) {
    const stopId = params.get('stop');
    return stopId ? { kind: 'route', routeId, stopId } : { kind: 'route', routeId };
  }

  const origin = decodeTripPoint(params.get('from'));
  const destination = decodeTripPoint(params.get('to'));
  if (origin || destination) return { kind: 'trip', origin, destination };

  const placeId = params.get('place');
  if (placeId) return { kind: 'place', placeId };

  const point = decodePoint(params.get('at'));
  if (point) return { kind: 'point', point };

  return null;
}
