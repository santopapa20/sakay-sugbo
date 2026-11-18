/**
 * Asking for a trip.
 *
 * With the static data source the answer is worked out in the browser by
 * features/trip/tripPlanner.ts. With the API data source the Spring Boot
 * backend works it out (GET /api/trips) using the same rules, ported to Java.
 * Either way the caller gets the same TripResult.
 */
import {
  findTrips,
  type RideLeg,
  type TripLeg,
  type TripNetwork,
  type TripOption,
  type TripResult,
} from '../features/trip/tripPlanner';
import type { LngLat, RouteDirection } from '../types';
import { getJson, USE_API } from './dataService';

/** What a trip search needs to know about the loaded routes. */
export interface TripContext {
  network: TripNetwork;
  routeById: Map<string, RouteDirection>;
}

/** A ride as the backend sends it: the route is named by id, not sent again in full. */
type ApiRideLeg = Omit<RideLeg, 'direction'> & { routeId: string };
type ApiLeg = Exclude<TripLeg, RideLeg> | ApiRideLeg;
type ApiTripResult = Omit<TripResult, 'options'> & {
  options: (Omit<TripOption, 'legs'> & { legs: ApiLeg[] })[];
};

async function planTripWithApi(
  origin: LngLat,
  destination: LngLat,
  routeById: Map<string, RouteDirection>,
): Promise<TripResult> {
  const query = new URLSearchParams({
    fromLat: String(origin.lat),
    fromLng: String(origin.lng),
    toLat: String(destination.lat),
    toLng: String(destination.lng),
  });
  const result = await getJson<ApiTripResult>(`/api/trips?${query}`);

  const options: TripOption[] = [];
  for (const option of result.options) {
    const legs: TripLeg[] = [];
    for (const leg of option.legs) {
      if (leg.kind === 'walk') {
        legs.push(leg);
        continue;
      }
      // Swap the route id for the full route the app already has in memory.
      const direction = routeById.get(leg.routeId);
      if (direction) legs.push({ ...leg, direction });
    }
    // An option naming a route this app does not know is dropped rather than shown half-drawn.
    if (legs.length === option.legs.length) options.push({ ...option, legs });
  }
  return { ...result, options };
}

export async function planTrip(
  origin: LngLat,
  destination: LngLat,
  context: TripContext,
): Promise<TripResult> {
  return USE_API
    ? planTripWithApi(origin, destination, context.routeById)
    : findTrips(context.network, origin, destination);
}
