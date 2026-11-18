import { describe, expect, it } from 'vitest';
import type { Coordinate } from '../types';
import {
  boundsOf,
  cumulativeMetres,
  formatDistance,
  haversineMetres,
  indexAtDistance,
  mainAxisDegrees,
  nearestOnLine,
  sliceLine,
} from './geo';

// Two real Cebu landmarks, roughly 1.9 km apart in a straight line.
const FUENTE_OSMENA = { lng: 123.8931, lat: 10.3095 };
const AYALA_CENTER = { lng: 123.9054, lat: 10.3181 };

// A straight west-to-east line along latitude 10.3, about 1.1 km long.
const LINE: Coordinate[] = [
  [123.89, 10.3],
  [123.895, 10.3],
  [123.9, 10.3],
];

describe('haversineMetres', () => {
  it('is zero for the same point', () => {
    expect(haversineMetres(FUENTE_OSMENA, FUENTE_OSMENA)).toBe(0);
  });

  it('measures a known Cebu distance', () => {
    const d = haversineMetres(FUENTE_OSMENA, AYALA_CENTER);
    expect(d).toBeGreaterThan(1600);
    expect(d).toBeLessThan(1700);
  });

  it('gives the same answer in both directions', () => {
    expect(haversineMetres(FUENTE_OSMENA, AYALA_CENTER)).toBeCloseTo(
      haversineMetres(AYALA_CENTER, FUENTE_OSMENA),
      6,
    );
  });

  it('measures one degree of latitude as about 111 km', () => {
    const d = haversineMetres({ lng: 123.9, lat: 10 }, { lng: 123.9, lat: 11 });
    expect(d / 1000).toBeCloseTo(111.2, 0);
  });
});

describe('cumulativeMetres', () => {
  it('starts at zero and only grows', () => {
    const totals = cumulativeMetres(LINE);
    expect(totals[0]).toBe(0);
    expect(totals[1]!).toBeGreaterThan(540);
    expect(totals[2]!).toBeCloseTo(totals[1]! * 2, 0);
  });
});

describe('nearestOnLine', () => {
  it('snaps a point beside the line onto it', () => {
    // About 111 m north of the middle of the first segment.
    const result = nearestOnLine({ lng: 123.8925, lat: 10.301 }, LINE)!;
    expect(result.point.lat).toBeCloseTo(10.3, 5);
    expect(result.point.lng).toBeCloseTo(123.8925, 4);
    expect(result.distanceM).toBeGreaterThan(105);
    expect(result.distanceM).toBeLessThan(117);
    expect(result.alongM).toBeCloseTo(cumulativeMetres(LINE)[1]! / 2, -1);
  });

  it('clamps to the end when the point is past the line', () => {
    const result = nearestOnLine({ lng: 123.91, lat: 10.3 }, LINE)!;
    expect(result.point.lng).toBeCloseTo(123.9, 6);
    expect(result.alongM).toBeCloseTo(cumulativeMetres(LINE)[2]!, 3);
  });

  it('returns null for a line with fewer than two points', () => {
    expect(nearestOnLine(FUENTE_OSMENA, [[123.89, 10.3]])).toBeNull();
  });
});

describe('sliceLine and indexAtDistance', () => {
  const totals = cumulativeMetres(LINE);

  it('finds the coordinate just before a distance', () => {
    expect(indexAtDistance(totals, 0)).toBe(0);
    expect(indexAtDistance(totals, totals[1]! + 1)).toBe(1);
    expect(indexAtDistance(totals, 999_999)).toBe(2);
  });

  it('cuts out the middle of a line', () => {
    const piece = sliceLine(LINE, totals, 100, totals[2]! - 100);
    expect(piece[0]![0]).toBeGreaterThan(123.89);
    expect(piece.at(-1)![0]).toBeLessThan(123.9);
    expect(piece).toContainEqual([123.895, 10.3]);
    const length = cumulativeMetres(piece).at(-1)!;
    expect(length).toBeCloseTo(totals[2]! - 200, 0);
  });
});

describe('boundsOf', () => {
  it('returns the south-west and north-east corners', () => {
    expect(boundsOf([[123.9, 10.31], [123.88, 10.33], [123.91, 10.3]])).toEqual([
      [123.88, 10.3],
      [123.91, 10.33],
    ]);
  });
});

describe('mainAxisDegrees', () => {
  it('is about 90 for a line running east-west', () => {
    expect(mainAxisDegrees(LINE)).toBeCloseTo(90, 0);
  });

  it('is about 0 for a line running north-south', () => {
    const axis = mainAxisDegrees([[123.9, 10.29], [123.9, 10.31], [123.9, 10.33]])!;
    expect(Math.min(axis, 180 - axis)).toBeLessThan(1);
  });

  it('is about 45 for a line running south-west to north-east', () => {
    expect(mainAxisDegrees([[123.89, 10.29], [123.9, 10.3], [123.91, 10.31]])).toBeCloseTo(45, 0);
  });

  it('is about 135 for a line running north-west to south-east', () => {
    expect(mainAxisDegrees([[123.89, 10.31], [123.9, 10.3], [123.91, 10.29]])).toBeCloseTo(135, 0);
  });

  it('returns null for a shape with no long direction', () => {
    const square: Coordinate[] = [[123.89, 10.29], [123.9, 10.29], [123.9, 10.3], [123.89, 10.3]];
    expect(mainAxisDegrees(square)).toBeNull();
    expect(mainAxisDegrees([[123.9, 10.3]])).toBeNull();
  });
});

describe('formatDistance', () => {
  it('uses metres under a kilometre and kilometres above', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(2440)).toBe('2.4 km');
  });
});
