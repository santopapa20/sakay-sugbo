/** App-wide settings in one place, so nothing important is buried in a component. */

export const APP_NAME = 'Sakay Sugbo';
export const APP_TAGLINE = 'Cebu jeepney route finder';

/** The opening camera: downtown Cebu City, tilted so the buildings read as 3D. */
export const HOME_VIEW = {
  center: [123.8962, 10.3068] as [number, number],
  // Buildings are drawn in 3D from zoom 14, so the opening view sits just above that.
  zoom: 14.5,
  pitch: 58,
  bearing: -24,
};

/** The map cannot be dragged beyond Metro Cebu: [west, south], [east, north]. */
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [123.66, 10.12],
  [124.14, 10.56],
];

/** A jeepney route counts as "passing here" when it comes within this distance. */
export const NEARBY_RADIUS_M = 300;

/** How far we assume someone will walk to reach or leave a jeepney. */
export const MAX_WALK_M = 500;

/** Two routes count as a transfer point where they come this close together. */
export const TRANSFER_RADIUS_M = 150;

/** Key used to remember favourites in the browser's local storage. */
export const FAVOURITES_STORAGE_KEY = 'sakay-sugbo:favourites:v1';
