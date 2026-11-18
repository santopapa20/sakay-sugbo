/**
 * Everything the app draws on top of the base map: the route network, the
 * selected route, its stops, category places and trip results.
 *
 * MapLibre works with "sources" (data) and "layers" (how to draw a source).
 * We create them all once, empty, and afterwards only swap the data. That is
 * much cheaper than adding and removing layers every time something changes.
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { RideLeg, TripOption } from '../features/trip/tripPlanner';
import type { Coordinate, Place, RouteDirection } from '../types';
import { FIRST_LABEL_LAYER } from './style';

const NIGHT = '#0b0f14';
const FOG = '#f2f5f7';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

export const LAYER = {
  network: 'network-lines',
  routeGlow: 'route-glow',
  routeCasing: 'route-casing',
  routeLine: 'route-line',
  routeArrows: 'route-arrows',
  routeStops: 'route-stops',
  routeStopSelected: 'route-stop-selected',
  routeStopLabels: 'route-stop-labels',
  places: 'places-dots',
  placeLabels: 'places-labels',
  tripWalk: 'trip-walk',
  tripPoints: 'trip-points',
} as const;

/** A trip has at most two rides (one transfer), each drawn by its own pair of layers. */
const TRIP_RIDES = [0, 1] as const;
const tripRideLayer = (index: number) => `trip-ride-${index}`;
const tripRideCasing = (index: number) => `trip-ride-${index}-casing`;

/** Layers that react to a tap. */
export const TAPPABLE_LAYERS = [LAYER.routeStops, LAYER.places, LAYER.placeLabels];

const collection = (features: Feature[] = []): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

const line = (coordinates: Coordinate[], properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates },
});

const point = (lng: number, lat: number, properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [lng, lat] },
});

function setData(map: MapLibreMap, sourceId: string, data: FeatureCollection<Geometry>) {
  (map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data);
}

/** A small chevron drawn in code, used as the direction arrow along a route. */
function addChevronImage(map: MapLibreMap) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.strokeStyle = '#000';
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(11, 7);
  context.lineTo(21, 16);
  context.lineTo(11, 25);
  context.stroke();
  // "sdf" lets MapLibre recolour the image, so one chevron serves every route.
  map.addImage('chevron', context.getImageData(0, 0, size, size), { sdf: true, pixelRatio: 2 });
}

const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const;

export function addAppLayers(map: MapLibreMap) {
  addChevronImage(map);

  map.addSource('network', { type: 'geojson', data: collection() });
  // lineMetrics lets a line be coloured by "how far along am I", which powers the draw-on animation.
  map.addSource('route', { type: 'geojson', data: collection(), lineMetrics: true });
  map.addSource('route-stops', { type: 'geojson', data: collection() });
  map.addSource('places', { type: 'geojson', data: collection() });
  map.addSource('trip-walk', { type: 'geojson', data: collection() });
  map.addSource('trip-points', { type: 'geojson', data: collection() });
  for (const i of TRIP_RIDES) {
    map.addSource(tripRideLayer(i), { type: 'geojson', data: collection(), lineMetrics: true });
  }

  // Lines and dots go under the base map's labels so street names stay readable.
  const under = FIRST_LABEL_LAYER;

  map.addLayer(
    {
      id: LAYER.network,
      type: 'line',
      source: 'network',
      layout: lineLayout,
      paint: {
        'line-color': ['get', 'colour'],
        'line-opacity': 0.5,
        'line-opacity-transition': { duration: 350 },
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 13, 1.4, 16, 3],
      },
    },
    under,
  );

  map.addLayer(
    {
      id: LAYER.routeGlow,
      type: 'line',
      source: 'route',
      layout: lineLayout,
      paint: { 'line-color': FOG, 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.22 },
    },
    under,
  );
  map.addLayer(
    {
      id: LAYER.routeCasing,
      type: 'line',
      source: 'route',
      layout: lineLayout,
      paint: {
        'line-color': NIGHT,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 11],
      },
    },
    under,
  );
  map.addLayer(
    {
      id: LAYER.routeLine,
      type: 'line',
      source: 'route',
      layout: lineLayout,
      paint: {
        'line-color': FOG,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 7],
      },
    },
    under,
  );
  map.addLayer(
    {
      id: LAYER.routeArrows,
      type: 'symbol',
      source: 'route',
      minzoom: 13,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 90,
        'icon-image': 'chevron',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.55, 16, 0.85],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-color': NIGHT, 'icon-opacity': 0.85 },
    },
    under,
  );

  map.addLayer(
    {
      id: LAYER.tripWalk,
      type: 'line',
      source: 'trip-walk',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FOG, 'line-width': 3, 'line-dasharray': [0.1, 2], 'line-opacity': 0.9 },
    },
    under,
  );
  for (const i of TRIP_RIDES) {
    map.addLayer(
      {
        id: tripRideCasing(i),
        type: 'line',
        source: tripRideLayer(i),
        layout: lineLayout,
        paint: {
          'line-color': NIGHT,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 12],
        },
      },
      under,
    );
    map.addLayer(
      {
        id: tripRideLayer(i),
        type: 'line',
        source: tripRideLayer(i),
        layout: lineLayout,
        paint: {
          'line-color': FOG,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 16, 8],
        },
      },
      under,
    );
  }
  map.addLayer(
    {
      id: LAYER.tripPoints,
      type: 'circle',
      source: 'trip-points',
      paint: {
        'circle-radius': 6,
        'circle-color': NIGHT,
        'circle-stroke-color': ['get', 'colour'],
        'circle-stroke-width': 3,
      },
    },
    under,
  );

  map.addLayer(
    {
      id: LAYER.routeStops,
      type: 'circle',
      source: 'route-stops',
      minzoom: 12.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 2.5, 16, 6],
        'circle-color': NIGHT,
        'circle-stroke-color': ['get', 'colour'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12.5, 1.2, 16, 2.5],
      },
    },
    under,
  );
  map.addLayer(
    {
      id: LAYER.routeStopSelected,
      type: 'circle',
      source: 'route-stops',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-radius': 9,
        'circle-color': ['get', 'colour'],
        'circle-stroke-color': NIGHT,
        'circle-stroke-width': 3,
      },
    },
    under,
  );

  // Our own labels go on the very top.
  map.addLayer({
    id: LAYER.routeStopLabels,
    type: 'symbol',
    source: 'route-stops',
    minzoom: 15.2,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'left',
      'text-offset': [0.9, 0],
      'text-max-width': 10,
      'text-optional': true,
    },
    paint: { 'text-color': FOG, 'text-halo-color': NIGHT, 'text-halo-width': 1.8 },
  });

  map.addLayer({
    id: LAYER.places,
    type: 'circle',
    source: 'places',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6.5],
      'circle-color': '#48bfd1',
      'circle-stroke-color': NIGHT,
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: LAYER.placeLabels,
    type: 'symbol',
    source: 'places',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-max-width': 9,
      'text-optional': true,
    },
    paint: { 'text-color': '#bfe9f0', 'text-halo-color': NIGHT, 'text-halo-width': 1.8 },
  });
}

// ----------------------------------------------------------- draw-on effect

const runningDraws = new Map<string, number>();

/**
 * Colours a line from its start to its end over `durationMs`, as if it were
 * being drawn along the street. With a duration of 0 it simply appears.
 */
function drawLine(map: MapLibreMap, layerId: string, colour: string, durationMs: number) {
  const previous = runningDraws.get(layerId);
  if (previous) cancelAnimationFrame(previous);

  const paint = (progress: number) => {
    if (!map.getLayer(layerId)) return;
    map.setPaintProperty(
      layerId,
      'line-gradient',
      progress >= 1
        ? ['interpolate', ['linear'], ['line-progress'], 0, colour, 1, colour]
        : ['step', ['line-progress'], colour, Math.max(progress, 0.0001), TRANSPARENT],
    );
  };

  if (durationMs <= 0) {
    paint(1);
    return;
  }
  const startedAt = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - startedAt) / durationMs);
    paint(1 - (1 - t) ** 3); // fast at first, easing to a stop
    if (t < 1) runningDraws.set(layerId, requestAnimationFrame(frame));
    else runningDraws.delete(layerId);
  };
  runningDraws.set(layerId, requestAnimationFrame(frame));
}

// ------------------------------------------------------------- data setters

export function setNetwork(map: MapLibreMap, routes: RouteDirection[]) {
  setData(
    map,
    'network',
    collection(routes.map((r) => line(r.coordinates, { id: r.id, code: r.code, colour: r.colour }))),
  );
}

/** Fades the whole network back so that one route or trip stands out. */
export function setNetworkDimmed(map: MapLibreMap, dimmed: boolean) {
  map.setPaintProperty(LAYER.network, 'line-opacity', dimmed ? 0.09 : 0.5);
}

export function showRoute(map: MapLibreMap, route: RouteDirection | null, animate: boolean) {
  if (!route) {
    setData(map, 'route', collection());
    setData(map, 'route-stops', collection());
    return;
  }
  setData(map, 'route', collection([line(route.coordinates)]));
  setData(
    map,
    'route-stops',
    collection(
      route.stops.map((stop) =>
        point(stop.lng, stop.lat, { id: stop.id, name: stop.name ?? '', colour: route.colour }),
      ),
    ),
  );
  map.setPaintProperty(LAYER.routeGlow, 'line-color', route.colour);
  // Longer routes take a little longer to draw, within limits.
  const duration = Math.min(1600, 700 + route.lengthM / 14);
  drawLine(map, LAYER.routeLine, route.colour, animate ? duration : 0);
}

export function setSelectedStop(map: MapLibreMap, stopId: string | null) {
  map.setFilter(LAYER.routeStopSelected, ['==', ['get', 'id'], stopId ?? '']);
}

export function setPlaces(map: MapLibreMap, places: Place[]) {
  setData(
    map,
    'places',
    collection(places.map((p) => point(p.lng, p.lat, { id: p.id, name: p.name }))),
  );
}

export function showTrip(map: MapLibreMap, option: TripOption | null, animate: boolean) {
  const rides = option ? option.legs.filter((leg): leg is RideLeg => leg.kind === 'ride') : [];

  for (const i of TRIP_RIDES) {
    const ride = rides[i];
    setData(map, tripRideLayer(i), collection(ride ? [line(ride.coordinates)] : []));
    if (ride) drawLine(map, tripRideLayer(i), ride.direction.colour, animate ? 900 : 0);
  }

  setData(
    map,
    'trip-walk',
    collection(
      (option?.legs ?? [])
        .filter((leg) => leg.kind === 'walk')
        .map((leg) => line([[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]])),
    ),
  );
  setData(
    map,
    'trip-points',
    collection(
      rides.flatMap((ride) => [
        point(ride.board.lng, ride.board.lat, { colour: ride.direction.colour }),
        point(ride.alight.lng, ride.alight.lat, { colour: ride.direction.colour }),
      ]),
    ),
  );
}
