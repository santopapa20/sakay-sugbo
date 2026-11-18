/**
 * Asking for a trip. Today the answer is worked out in the browser by
 * features/trip/tripPlanner.ts. It is wrapped in a Promise on purpose: when
 * the Spring Boot backend takes over pathfinding, this becomes a `fetch` to
 * GET /api/trips and nothing that calls it has to change.
 */
import { findTrips, type TripNetwork, type TripResult } from '../features/trip/tripPlanner';
import type { LngLat } from '../types';

export async function planTrip(
  network: TripNetwork,
  origin: LngLat,
  destination: LngLat,
): Promise<TripResult> {
  return findTrips(network, origin, destination);
}
