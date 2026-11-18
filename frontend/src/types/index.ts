/**
 * The shapes of the data the whole app works with.
 *
 * Everything here mirrors what the OpenStreetMap import writes into
 * public/data/, and is the contract the future Spring Boot API will return.
 */

/** A position on the map. Longitude first matches GeoJSON and MapLibre. */
export interface LngLat {
  lng: number;
  lat: number;
}

/** A `[longitude, latitude]` pair exactly as stored in GeoJSON. */
export type Coordinate = [number, number];

/** A mapped stop on one direction of a route. */
export interface RouteStop extends LngLat {
  id: string;
  /** Null when the stop has no name in OpenStreetMap. */
  name: string | null;
  /** Metres from the start of the route to this stop. */
  alongM: number;
}

/** "From point number `fromIndex` onwards the route runs on this street." */
export interface StreetStretch {
  name: string | null;
  fromIndex: number;
}

/**
 * One direction of travel of a jeepney route, for example "13C from Colon to
 * Talamban". The opposite direction is a separate RouteDirection because
 * jeepneys often use different streets each way.
 */
export interface RouteDirection {
  id: string;
  /** The code painted on the jeepney, e.g. "13C". */
  code: string;
  name: string | null;
  /** Terminals as recorded in OpenStreetMap. Null means "not recorded". */
  from: string | null;
  to: string | null;
  firstStopName: string | null;
  lastStopName: string | null;
  operator: string | null;
  network: string | null;
  colour: string;
  lengthM: number;
  streets: StreetStretch[];
  stops: RouteStop[];
  osmRelationId: number;
  /** True only once someone has checked the route on the ground. */
  fieldVerified: boolean;
  /**
   * True when another direction of the same code has the very same from/to
   * recorded, so those names cannot say which way this one runs. Worked out on load.
   */
  terminalsAmbiguous?: boolean;
  /** The line the jeepney drives, in order of travel. */
  coordinates: Coordinate[];
  /** Metres from the start of the route to each coordinate (worked out on load). */
  cumulativeM: number[];
}

/** All mapped directions that share one code. */
export interface RouteGroup {
  code: string;
  colour: string;
  directions: RouteDirection[];
}

export type PlaceCategory =
  | 'terminal'
  | 'transport'
  | 'education'
  | 'hospital'
  | 'shopping'
  | 'government'
  | 'landmark'
  | 'area'
  | 'street';

export interface Place extends LngLat {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
}

/** Where a trip starts or ends: a known place, a tapped point, or the user's position. */
export interface TripPoint extends LngLat {
  label: string;
  kind: 'place' | 'pin' | 'me';
}

/** Facts about the data set, shown in the "About the data" dialog. */
export interface DataMeta {
  source: string;
  licence: string;
  licenceUrl: string;
  osmDataTimestamp: string | null;
  importedAt: string;
  fieldVerified: boolean;
  note: string;
  counts: {
    routeDirections: number;
    routeCodes: number;
    places: number;
    streets: number;
  };
  skippedRoutes: { code: string; relation: number; reason: string }[];
}
