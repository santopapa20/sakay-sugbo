/**
 * Small geographic calculations. No map library is needed for these, which
 * keeps them easy to test and easy to port to the Java backend later.
 */
import type { Coordinate, LngLat } from '../types';

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Distance in metres between two points on the Earth's surface (the
 * "haversine" formula). Accurate to well under a metre at city scale.
 */
export function haversineMetres(a: LngLat, b: LngLat): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const toLngLat = ([lng, lat]: Coordinate): LngLat => ({ lng, lat });

/** Running total of the line's length: one number per coordinate, starting at 0. */
export function cumulativeMetres(line: Coordinate[]): number[] {
  const totals: number[] = [];
  let total = 0;
  line.forEach((point, index) => {
    const previous = line[index - 1];
    if (previous) total += haversineMetres(toLngLat(previous), toLngLat(point));
    totals.push(total);
  });
  return totals;
}

export interface NearestOnLine {
  /** The closest point that lies on the line. */
  point: LngLat;
  /** Metres from the given point to the line. */
  distanceM: number;
  /** Metres from the start of the line to `point`. */
  alongM: number;
}

/**
 * Finds the point on a line closest to `target`.
 *
 * Works segment by segment. Over a few hundred metres the Earth is close
 * enough to flat that we can treat longitude/latitude as x/y, as long as
 * longitude is scaled by cos(latitude) so that one unit means the same
 * distance in both directions.
 */
export function nearestOnLine(
  target: LngLat,
  line: Coordinate[],
  cumulative: number[] = cumulativeMetres(line),
): NearestOnLine | null {
  let best: NearestOnLine | null = null;
  const scaleX = Math.cos(toRadians(target.lat));

  for (let i = 0; i < line.length - 1; i++) {
    const a = toLngLat(line[i]!);
    const b = toLngLat(line[i + 1]!);
    const ax = a.lng * scaleX;
    const bx = b.lng * scaleX;
    const tx = target.lng * scaleX;
    const dx = bx - ax;
    const dy = b.lat - a.lat;
    const lengthSquared = dx * dx + dy * dy;
    // How far along the segment the closest point is: 0 = at a, 1 = at b.
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((tx - ax) * dx + (target.lat - a.lat) * dy) / lengthSquared));
    const point = { lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t };
    const distanceM = haversineMetres(target, point);
    if (!best || distanceM < best.distanceM) {
      const segmentM = cumulative[i + 1]! - cumulative[i]!;
      best = { point, distanceM, alongM: cumulative[i]! + segmentM * t };
    }
  }
  return best;
}

/** The part of a line between two distances from its start, in metres. */
export function sliceLine(
  line: Coordinate[],
  cumulative: number[],
  fromM: number,
  toM: number,
): Coordinate[] {
  const pointAt = (metres: number): Coordinate => {
    const index = indexAtDistance(cumulative, metres);
    const a = line[index]!;
    const b = line[index + 1];
    if (!b) return a;
    const span = cumulative[index + 1]! - cumulative[index]!;
    const t = span === 0 ? 0 : (metres - cumulative[index]!) / span;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  const result: Coordinate[] = [pointAt(fromM)];
  for (let i = 0; i < line.length; i++) {
    if (cumulative[i]! > fromM && cumulative[i]! < toM) result.push(line[i]!);
  }
  result.push(pointAt(toM));
  return result;
}

/** Index of the last coordinate at or before `metres` along the line. */
export function indexAtDistance(cumulative: number[], metres: number): number {
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (cumulative[middle]! <= metres) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The smallest box containing all the coordinates: [[west, south], [east, north]]. */
export function boundsOf(coordinates: Coordinate[]): [[number, number], [number, number]] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * The compass direction (0 = north, 90 = east) that a set of points is
 * stretched along, between 0 and 180. A route running south-west to
 * north-east gives about 45.
 *
 * Found with the standard "line of best fit through a cloud of points"
 * calculation. Returns null when the points have no clear long direction
 * (a single point, or a shape as wide as it is long).
 */
export function mainAxisDegrees(coordinates: Coordinate[]): number | null {
  if (coordinates.length < 2) return null;
  const meanLat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const scaleX = Math.cos(toRadians(meanLat));
  const meanX = (coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length) * scaleX;

  // How much the points spread east-west (xx), north-south (yy), and together (xy).
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [lng, lat] of coordinates) {
    const dx = lng * scaleX - meanX;
    const dy = lat - meanLat;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const spreadDifference = Math.hypot(xx - yy, 2 * xy);
  if (spreadDifference < (xx + yy) * 0.15) return null; // roughly round: no main direction

  const angleFromEast = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;
  return (((90 - angleFromEast) % 180) + 180) % 180;
}

/** "350 m" or "2.4 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
