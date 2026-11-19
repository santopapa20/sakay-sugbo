/**
 * The one place the app gets its transit data from.
 *
 * Components never call `fetch` themselves; they ask this service. There are
 * two interchangeable sources, chosen by the VITE_DATA_SOURCE setting:
 *
 *   static (default)  GeoJSON files in public/data/. Needs no server, so the
 *                     app can be hosted anywhere, even on GitHub Pages.
 *   api               The Spring Boot backend (see backend/README.md).
 *                     Start the frontend with `npm run dev:api`.
 *
 * Both return exactly the same shapes, so nothing else in the app knows or
 * cares which one is in use.
 */
import type { FeatureCollection, LineString, Point } from 'geojson';
import { flagAmbiguousTerminals } from '../features/routes/routeModel';
import type { Coordinate, DataMeta, Place, RouteDirection } from '../types';
import { cumulativeMetres } from '../utils/geo';

export interface TransitDataService {
  getRoutes(): Promise<RouteDirection[]>;
  getPlaces(): Promise<Place[]>;
  getMeta(): Promise<DataMeta>;
}

/** True when the app should talk to the Spring Boot backend. */
export const USE_API = import.meta.env.VITE_DATA_SOURCE === 'api';

/**
 * Where the bundled data files live. BASE_URL is the folder the app is served
 * from ("/" on your own computer, "./" in a built site), so this also works
 * when the site sits in a sub-folder, as it does on GitHub Pages.
 */
const DATA_URL = `${import.meta.env.BASE_URL}data/`;

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

/** A route as it arrives, before the two values we work out ourselves are added. */
type RawRoute = Omit<RouteDirection, 'cumulativeM' | 'terminalsAmbiguous'>;
type RouteProperties = Omit<RawRoute, 'coordinates'>;
type PlaceProperties = Omit<Place, 'lng' | 'lat'>;

/** Adds the running distance along each line, and flags clashing terminal names. */
function prepareRoutes(routes: RawRoute[]): RouteDirection[] {
  return flagAmbiguousTerminals(
    routes.map((route) => ({ ...route, cumulativeM: cumulativeMetres(route.coordinates) })),
  );
}

/** Reads the GeoJSON files that tools/osm-import/import.mjs writes. */
class StaticFileDataService implements TransitDataService {
  async getRoutes(): Promise<RouteDirection[]> {
    const collection = await getJson<FeatureCollection<LineString, RouteProperties>>(
      `${DATA_URL}routes.geojson`,
    );
    return prepareRoutes(
      collection.features.map((feature) => ({
        ...feature.properties,
        coordinates: feature.geometry.coordinates as Coordinate[],
      })),
    );
  }

  async getPlaces(): Promise<Place[]> {
    const collection = await getJson<FeatureCollection<Point, PlaceProperties>>(
      `${DATA_URL}places.geojson`,
    );
    return collection.features.map((feature) => ({
      ...feature.properties,
      lng: feature.geometry.coordinates[0]!,
      lat: feature.geometry.coordinates[1]!,
    }));
  }

  getMeta(): Promise<DataMeta> {
    return getJson<DataMeta>(`${DATA_URL}meta.json`);
  }
}

/** Asks the Spring Boot backend. Its JSON already has the shapes the app uses. */
class ApiDataService implements TransitDataService {
  async getRoutes(): Promise<RouteDirection[]> {
    return prepareRoutes(await getJson<RawRoute[]>('/api/routes'));
  }

  getPlaces(): Promise<Place[]> {
    return getJson<Place[]>('/api/places');
  }

  getMeta(): Promise<DataMeta> {
    return getJson<DataMeta>('/api/meta');
  }
}

export const dataService: TransitDataService = USE_API
  ? new ApiDataService()
  : new StaticFileDataService();
