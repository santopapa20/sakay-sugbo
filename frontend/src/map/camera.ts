/**
 * Moving the map camera. Every move goes through here so that it always
 * allows for the panels covering part of the map.
 */
import type { Map as MapLibreMap, PaddingOptions } from 'maplibre-gl';
import { HOME_VIEW } from '../config';
import type { Coordinate, LngLat } from '../types';
import { boundsOf, mainAxisDegrees } from '../utils/geo';

export const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * How much of each edge is hidden behind interface. MapLibre treats the
 * remaining rectangle as "the screen", so "centre on this stop" puts the stop
 * in the middle of the part you can actually see.
 */
export function cameraPadding(): PaddingOptions {
  if (window.matchMedia(DESKTOP_QUERY).matches) {
    return { top: 80, right: 72, bottom: 40, left: 440 };
  }
  // Phone: search bar and chips on top; the half-open sheet plus the tab bar below.
  // The right-hand value also clears the column of map buttons.
  return { top: 116, right: 60, bottom: Math.round(window.innerHeight * 0.46) + 60, left: 12 };
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Camera moves glide normally, and jump straight there for people who ask for less motion. */
const duration = (ms: number) => (prefersReducedMotion() ? 0 : ms);

/**
 * The map rotation that lays a line out left-to-right across the screen.
 *
 * The part of the map not covered by panels is wider than it is tall,
 * especially on a phone. Turning the map so that a route runs across it lets
 * the route be shown about twice as large. Of the two rotations that do this
 * (they differ by half a turn) we take the one needing the smaller turn.
 */
function bearingAlongScreen(coordinates: Coordinate[], currentBearing: number): number {
  const axis = mainAxisDegrees(coordinates);
  if (axis === null) return currentBearing;
  const turn = (bearing: number) => Math.abs(((bearing - currentBearing + 540) % 360) - 180);
  const [a, b] = [axis - 90, axis + 90];
  const best = turn(a) <= turn(b) ? a : b;
  return ((best + 540) % 360) - 180; // keep within -180..180
}

/** Frames a whole line (a route or a trip) in the visible part of the map. */
export function fitCoordinates(map: MapLibreMap, coordinates: Coordinate[], maxZoom = 16) {
  if (coordinates.length === 0) return;
  // Phones have little room between the search bar and the sheet, so use a thinner margin there.
  const margin = window.matchMedia(DESKTOP_QUERY).matches ? 64 : 24;
  const camera = map.cameraForBounds(boundsOf(coordinates), {
    padding: margin,
    bearing: bearingAlongScreen(coordinates, map.getBearing()),
    maxZoom,
  });
  if (!camera) return;
  // A gentler tilt than the home view: an overview should not hide the far end of the route.
  map.easeTo({ ...camera, pitch: 38, duration: duration(1300) });
}

export function flyToPoint(map: MapLibreMap, point: LngLat, minZoom = 15.5) {
  map.flyTo({
    center: [point.lng, point.lat],
    zoom: Math.max(map.getZoom(), minZoom),
    duration: duration(1100),
  });
}

export function panToPoint(map: MapLibreMap, point: LngLat) {
  map.easeTo({ center: [point.lng, point.lat], duration: duration(500) });
}

export function goHome(map: MapLibreMap) {
  map.flyTo({ ...HOME_VIEW, duration: duration(1400) });
}

export function zoomBy(map: MapLibreMap, delta: number) {
  map.easeTo({ zoom: map.getZoom() + delta, duration: duration(250) });
}

export function resetNorth(map: MapLibreMap) {
  map.easeTo({ bearing: 0, duration: duration(500) });
}

/** Switches between the tilted 3D view and a flat, straight-down view. */
export function setTilted(map: MapLibreMap, tilted: boolean) {
  map.easeTo({ pitch: tilted ? HOME_VIEW.pitch : 0, duration: duration(700) });
}
