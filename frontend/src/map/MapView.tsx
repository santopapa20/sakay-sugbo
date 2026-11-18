/**
 * The map. This component owns the MapLibre instance and keeps it in step
 * with the app's state: when the store says "route 13C is selected", an
 * effect here draws it and moves the camera.
 *
 * React does not draw the map itself. MapLibre does, on a WebGL canvas, so
 * each `useEffect` below is a small translation from state to map commands.
 */
import { AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre does its heavy work in a background "worker" script. Vite needs to
// be told to bundle it, and MapLibre needs to be told where it ended up.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '../components/ErrorState';
import { HOME_VIEW, MAP_BOUNDS } from '../config';
import type { RideLeg } from '../features/trip/tripPlanner';
import { useAppStore, useSelectedRoute, type MapHit } from '../store/appStore';
import { cameraPadding, fitCoordinates, flyToPoint, panToPoint } from './camera';
import { FloatingLabels, type LabelSpec } from './floatingLabels';
import {
  addAppLayers,
  LAYER,
  setNetwork,
  setNetworkDimmed,
  setPlaces,
  setSelectedStop,
  showRoute,
  showTrip,
  TAPPABLE_LAYERS,
} from './layers';
import { MapControls } from './MapControls';
import { buildMapStyle } from './style';

setWorkerUrl(workerUrl);

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<FloatingLabels | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);
  /** Set once the style has loaded and our layers exist. Effects wait for it. */
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const animate = !useReducedMotion();

  const routes = useAppStore((s) => s.routes);
  const places = useAppStore((s) => s.places);
  const tab = useAppStore((s) => s.tab);
  const focus = useAppStore((s) => s.focus);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const selectedStopId = useAppStore((s) => s.selectedStopId);
  const tripOrigin = useAppStore((s) => s.tripOrigin);
  const tripDestination = useAppStore((s) => s.tripDestination);
  const tripResult = useAppStore((s) => s.tripResult);
  const tripSelected = useAppStore((s) => s.tripSelected);
  const picking = useAppStore((s) => s.picking);
  const userLocation = useAppStore((s) => s.userLocation);
  const selectedRoute = useSelectedRoute();

  const tripOption = tab === 'trip' && !selectedRoute ? (tripResult?.options[tripSelected] ?? null) : null;
  const selectedStop = selectedRoute?.stops.find((stop) => stop.id === selectedStopId) ?? null;

  // ---- create the map once (again only if the user presses "Try again")
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setFailed(null);

    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
        container,
        style: buildMapStyle(),
        ...HOME_VIEW,
        maxBounds: MAP_BOUNDS,
        minZoom: 10.5,
        maxZoom: 18.5,
        maxPitch: 70,
        attributionControl: false,
      });
    } catch (error) {
      // Usually: this device or browser has WebGL switched off.
      setFailed(error instanceof Error ? error.message : 'The map could not start.');
      return;
    }

    // While developing, the map can be inspected from the browser console as `__map`.
    if (import.meta.env.DEV) (window as unknown as { __map?: MapLibreMap }).__map = instance;

    instance.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    instance.setPadding(cameraPadding());
    let loaded = false;

    instance.on('load', () => {
      loaded = true;
      setFailed(null); // an early hiccup that the map recovered from is not a failure
      addAppLayers(instance);
      labelsRef.current = new FloatingLabels(instance);
      setMap(instance);
    });

    // A missing tile now and then is normal. Failing before the first load is not.
    instance.on('error', (event) => {
      if (!loaded) setFailed(event.error?.message ?? 'The base map could not be loaded.');
    });

    instance.on('click', (event) => {
      const { x, y } = event.point;
      // Search a small box around the tap, so fingers do not need to be exact.
      const hits = instance.queryRenderedFeatures(
        [
          [x - 8, y - 8],
          [x + 8, y + 8],
        ],
        { layers: TAPPABLE_LAYERS.filter((id) => instance.getLayer(id)) },
      );
      const stop = hits.find((f) => f.layer.id === LAYER.routeStops);
      const place = hits.find((f) => f.layer.id !== LAYER.routeStops);
      const hit: MapHit = stop
        ? { kind: 'stop', id: String(stop.properties.id) }
        : place
          ? { kind: 'place', id: String(place.properties.id) }
          : null;
      useAppStore.getState().handleMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat }, hit);
    });

    const pointer = () => (instance.getCanvas().style.cursor = 'pointer');
    const noPointer = () => (instance.getCanvas().style.cursor = '');
    for (const layer of TAPPABLE_LAYERS) {
      instance.on('mouseenter', layer, pointer);
      instance.on('mouseleave', layer, noPointer);
    }

    const onResize = () => instance.setPadding(cameraPadding());
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      labelsRef.current?.destroy();
      labelsRef.current = null;
      meMarkerRef.current = null;
      setMap(null);
      instance.remove();
    };
  }, [attempt]);

  // ---- the faint network of every route
  useEffect(() => {
    if (map) setNetwork(map, routes);
  }, [map, routes]);

  useEffect(() => {
    if (map) setNetworkDimmed(map, Boolean(selectedRoute || tripOption));
  }, [map, selectedRoute, tripOption]);

  // ---- the selected route
  useEffect(() => {
    if (!map) return;
    showRoute(map, selectedRoute, animate);
    if (selectedRoute) fitCoordinates(map, selectedRoute.coordinates);
  }, [map, selectedRoute, animate]);

  useEffect(() => {
    if (!map) return;
    setSelectedStop(map, selectedStop?.id ?? null);
    if (selectedStop) flyToPoint(map, selectedStop, 15.8);
  }, [map, selectedStop]);

  // ---- places of the chosen category
  const categoryPlaces = useMemo(
    () => (activeCategory ? places.filter((place) => place.category === activeCategory) : []),
    [places, activeCategory],
  );
  useEffect(() => {
    if (map) setPlaces(map, categoryPlaces);
  }, [map, categoryPlaces]);

  // ---- the chosen trip option
  useEffect(() => {
    if (!map) return;
    showTrip(map, tripOption, animate);
    if (tripOption) {
      fitCoordinates(
        map,
        tripOption.legs.flatMap((leg) =>
          leg.kind === 'ride'
            ? leg.coordinates
            : [
                [leg.from.lng, leg.from.lat] as [number, number],
                [leg.to.lng, leg.to.lat] as [number, number],
              ],
        ),
      );
    }
  }, [map, tripOption, animate]);

  // ---- trip ends that have no ride drawn yet: still bring them into view
  useEffect(() => {
    if (!map || tab !== 'trip' || tripOption) return;
    if (tripOrigin && tripDestination) {
      fitCoordinates(map, [
        [tripOrigin.lng, tripOrigin.lat],
        [tripDestination.lng, tripDestination.lat],
      ]);
    } else if (tripOrigin ?? tripDestination) {
      flyToPoint(map, (tripOrigin ?? tripDestination)!, 14.5);
    }
  }, [map, tab, tripOption, tripOrigin, tripDestination]);

  // ---- what the Explore tab is looking at
  useEffect(() => {
    if (!map || !focus) return;
    if (focus.kind === 'place') flyToPoint(map, focus.place);
    else panToPoint(map, focus.point);
  }, [map, focus]);

  // ---- floating labels
  useEffect(() => {
    if (!map || !labelsRef.current) return;
    const labels: LabelSpec[] = [];

    if (selectedRoute) {
      const first = selectedRoute.stops[0];
      const last = selectedRoute.stops.at(-1);
      const accent = selectedRoute.colour;
      if (first) labels.push({ key: 'route-start', ...first, overline: 'Start', title: first.name ?? 'First stop', accent });
      if (last && last !== first) labels.push({ key: 'route-end', ...last, overline: 'End', title: last.name ?? 'Last stop', accent });
      if (selectedStop && selectedStop !== first && selectedStop !== last) {
        labels.push({ key: 'stop', ...selectedStop, overline: 'Stop', title: selectedStop.name ?? 'Unnamed stop', accent });
      }
    } else if (tab === 'trip') {
      if (tripOrigin) labels.push({ key: 'trip-from', ...tripOrigin, overline: 'From', title: tripOrigin.label });
      if (tripDestination) labels.push({ key: 'trip-to', ...tripDestination, overline: 'To', title: tripDestination.label });
      const rides = tripOption?.legs.filter((leg): leg is RideLeg => leg.kind === 'ride') ?? [];
      const second = rides[1];
      if (second) {
        labels.push({
          key: 'trip-change',
          ...second.board,
          overline: 'Change here',
          title: `to ${second.direction.code}`,
          accent: second.direction.colour,
        });
      }
    } else if (focus) {
      labels.push(
        focus.kind === 'place'
          ? { key: 'focus', ...focus.place, title: focus.place.name, accent: '#48bfd1' }
          : { key: 'focus', ...focus.point, overline: 'Here', title: 'Tapped point' },
      );
    }
    labelsRef.current.sync(labels);
  }, [map, selectedRoute, selectedStop, tab, tripOrigin, tripDestination, tripOption, focus]);

  // ---- the user's own position
  useEffect(() => {
    if (!map) return;
    if (!userLocation) {
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      return;
    }
    if (!meMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'me-marker';
      element.setAttribute('aria-hidden', 'true');
      meMarkerRef.current = new Marker({ element }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    } else {
      meMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [map, userLocation]);

  // ---- a crosshair cursor while the user is choosing a trip end on the map
  useEffect(() => {
    if (map) map.getCanvas().style.cursor = picking ? 'crosshair' : '';
  }, [map, picking]);

  return (
    <>
      {/* MapLibre's stylesheet makes its container position: relative, so the
          full-screen positioning lives on this wrapper instead. */}
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          className="size-full"
          role="region"
          aria-label="Map of Cebu City showing jeepney routes. Route details are also listed as text in the panel."
        />
      </div>
      {!map && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="eyebrow" role="status">
            Loading the map of Cebu
          </p>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 lg:pl-[440px]">
          <div className="panel max-w-sm p-5">
            <ErrorState
              title="The map could not be shown"
              message="Route lists and the trip finder still work in the panel. The map needs an internet connection and a browser with WebGL turned on."
              detail={failed}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          </div>
        </div>
      )}
      {map && <MapControls map={map} />}
    </>
  );
}
