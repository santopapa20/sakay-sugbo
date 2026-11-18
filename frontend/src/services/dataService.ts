/**
 * The one place the app gets its transit data from.
 *
 * Components never call `fetch` themselves; they ask this service. Today the
 * data comes from static GeoJSON files in public/data/. When the Spring Boot
 * backend exists, only this file changes: a second implementation of
 * TransitDataService that calls /api/routes and /api/places (see
 * backend/README.md for the planned endpoints).
 */
import type { FeatureCollection, LineString, Point } from 'geojson';
import { flagAmbiguousTerminals } from '../features/routes/routeModel';
import type { DataMeta, Place, RouteDirection } from '../types';
import { cumulativeMetres } from '../utils/geo';

export interface TransitDataService {
  getRoutes(): Promise<RouteDirection[]>;
  getPlaces(): Promise<Place[]>;
  getMeta(): Promise<DataMeta>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

type RouteProperties = Omit<RouteDirection, 'coordinates' | 'cumulativeM'>;
type PlaceProperties = Omit<Place, 'lng' | 'lat'>;

/** Reads the GeoJSON files that tools/osm-import/import.mjs writes. */
class StaticFileDataService implements TransitDataService {
  async getRoutes(): Promise<RouteDirection[]> {
    const collection = await getJson<FeatureCollection<LineString, RouteProperties>>(
      '/data/routes.geojson',
    );
    const routes = collection.features.map((feature) => {
      const coordinates = feature.geometry.coordinates as [number, number][];
      return {
        ...feature.properties,
        coordinates,
        cumulativeM: cumulativeMetres(coordinates),
      };
    });
    return flagAmbiguousTerminals(routes);
  }

  async getPlaces(): Promise<Place[]> {
    const collection = await getJson<FeatureCollection<Point, PlaceProperties>>(
      '/data/places.geojson',
    );
    return collection.features.map((feature) => ({
      ...feature.properties,
      lng: feature.geometry.coordinates[0]!,
      lat: feature.geometry.coordinates[1]!,
    }));
  }

  getMeta(): Promise<DataMeta> {
    return getJson<DataMeta>('/data/meta.json');
  }
}

export const dataService: TransitDataService = new StaticFileDataService();
