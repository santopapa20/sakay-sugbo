/**
 * The look of the base map: a dark, quiet city so that jeepney routes are
 * the brightest thing on screen.
 *
 * The streets, water and building footprints are real OpenStreetMap data,
 * served as vector tiles by OpenFreeMap (free, no API key, no account).
 * Building heights come from the same data: where a mapper recorded a height
 * or a number of floors, the building is that tall; otherwise the tile
 * provider falls back to a low default. Nothing is invented here.
 */
import type { StyleSpecification } from 'maplibre-gl';

const TILES_URL = 'https://tiles.openfreemap.org/planet';
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/** Map colours. They sit just below the UI's "night" tokens so panels read as above the map. */
const C = {
  land: '#0d1117',
  water: '#081a26',
  waterLine: '#0c2433',
  green: '#0f1a18',
  built: '#10161d',
  pier: '#141b23',
  roadMinor: '#1a212a',
  roadMid: '#222b36',
  roadMajor: '#2c3745',
  roadTrunk: '#374556',
  rail: '#232c36',
  buildingFlat: '#161d26',
  buildingLow: '#1b232d',
  buildingMid: '#2a3542',
  buildingTall: '#44566a',
  labelCity: '#c6cfd7',
  labelArea: '#7f8b98',
  labelRoad: '#657180',
  labelWater: '#3f6679',
  halo: '#0b0f14',
};

export const BUILDINGS_3D_LAYER = 'buildings-3d';
export const BUILDINGS_FLAT_LAYER = 'buildings-flat';
/** App layers (routes, stops ...) are inserted just below this one, so labels stay on top. */
export const FIRST_LABEL_LAYER = 'label-road';

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Sakay Sugbo Night',
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: { type: 'vector', url: TILES_URL },
    },
    // A soft, cool light from the south-west gives the buildings a lit side and a shaded side.
    light: { anchor: 'viewport', color: '#dce8f5', intensity: 0.42, position: [1.4, 215, 38] },
    // Haze towards the horizon, so a tilted view fades out instead of ending in a hard edge.
    sky: {
      'sky-color': '#0a1018',
      'horizon-color': '#16212d',
      'fog-color': '#0b0f14',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.8,
      'fog-ground-blend': 0.75,
      'atmosphere-blend': 0,
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': C.land } },
      {
        id: 'landuse-built',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
        paint: { 'fill-color': C.built },
      },
      {
        id: 'landcover-green',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]],
        paint: { 'fill-color': C.green, 'fill-opacity': 0.9 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': C.green },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': C.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: {
          'line-color': C.waterLine,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 3],
        },
      },
      {
        id: 'pier',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'class'], 'pier']],
        paint: { 'fill-color': C.pier },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': C.rail, 'line-width': 1 },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 12,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track', 'path']]],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.roadMinor,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.4, 15, 2, 18, 9],
        },
      },
      {
        id: 'road-mid',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.roadMid,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 0.5, 14, 2.5, 18, 14],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'class'], 'primary'],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.roadMajor,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.6, 14, 3.2, 18, 18],
        },
      },
      {
        id: 'road-trunk',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', ['trunk', 'motorway']]],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.roadTrunk,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.7, 14, 3.6, 18, 20],
        },
      },
      {
        // Seen from straight above, or zoomed far out, buildings are flat shapes.
        id: BUILDINGS_FLAT_LAYER,
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        maxzoom: 14.5,
        paint: {
          'fill-color': C.buildingFlat,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.6, 1],
        },
      },
      {
        // The 3D city: each footprint is pushed up to its recorded height.
        id: BUILDINGS_3D_LAYER,
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!', ['has', 'hide_3d']],
        paint: {
          // Taller buildings are lighter, which separates towers from the low city around them.
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 5],
            0,
            C.buildingLow,
            20,
            C.buildingMid,
            90,
            C.buildingTall,
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: FIRST_LABEL_LAYER,
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'trunk', 'minor']]],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 12.5],
          'text-letter-spacing': 0.04,
          'symbol-spacing': 320,
        },
        paint: { 'text-color': C.labelRoad, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'label-water',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Italic'],
          'text-size': 11.5,
          'text-letter-spacing': 0.18,
          'text-max-width': 7,
        },
        paint: { 'text-color': C.labelWater, 'text-halo-color': C.water, 'text-halo-width': 1 },
      },
      {
        id: 'label-area',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 11.5,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 12.5],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.14,
          'text-max-width': 8,
        },
        paint: { 'text-color': C.labelArea, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'label-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 12, 14, 17],
          'text-letter-spacing': 0.06,
          'text-max-width': 8,
        },
        paint: { 'text-color': C.labelCity, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
      },
    ],
  };
}
