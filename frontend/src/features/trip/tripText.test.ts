import { describe, expect, it } from 'vitest';
import type { TripPoint } from '../../types';
import { EAST, NORTH } from './testRoutes';
import { buildTripNetwork, findTrips } from './tripPlanner';
import { describeTrip, explainNoTrip, summariseTrip } from './tripText';

const network = buildTripNetwork([EAST, NORTH]);

const start = { lng: 123.885, lat: 10.302 };
const mall: TripPoint = { lng: 123.9005, lat: 10.325, label: 'The Mall', kind: 'place' };

describe('describeTrip', () => {
  const option = findTrips(network, start, mall).options[0]!;
  const steps = describeTrip(option, mall);

  it('lists the steps in the order you do them', () => {
    expect(steps.map((s) => s.kind)).toEqual(['walk', 'ride', 'walk', 'ride', 'walk']);
  });

  it('starts by walking to a named stop', () => {
    expect(steps[0]!.title).toMatch(/^Walk about \d+ m to the EAST stop \d+ stop$/);
  });

  it('names the route, its direction, and the stop and street to board at', () => {
    expect(steps[1]!.title).toBe('Ride EAST toward EAST Terminal');
    expect(steps[1]!.detail).toMatch(/Board at the EAST stop \d+ stop on EAST Street\./);
    expect(steps[1]!.detail).toMatch(/Get off at the EAST stop \d+ stop on EAST Street\./);
    expect(steps[1]!.code).toBe('EAST');
  });

  it('describes the change between jeepneys', () => {
    expect(steps[2]!.title).toMatch(/change to NORTH/i);
  });

  it('ends at the destination by name', () => {
    expect(steps.at(-1)!.title).toMatch(/The Mall$/);
  });

  it('skips a first walk too short to mention', () => {
    // Standing exactly on a stop of EAST (stops are every 250 m from 123.880).
    const onAStop = { lng: EAST.stops[2]!.lng, lat: EAST.stops[2]!.lat };
    const there: TripPoint = { lng: 123.915, lat: 10.3, label: 'There', kind: 'pin' };
    const direct = findTrips(network, onAStop, there).options[0]!;
    expect(describeTrip(direct, there)[0]!.kind).toBe('ride');
  });

  it('summarises changes, riding and walking', () => {
    expect(summariseTrip(option)).toMatch(/^1 change · \d\.\d km ride · \d+ m walk$/);
  });
});

describe('explainNoTrip', () => {
  it('never claims that no ride exists, only that none was confirmed', () => {
    const { title, message } = explainNoTrip('no-connection', 5000);
    expect(title).toBe('No ride could be confirmed');
    expect(message).toMatch(/may still exist/);
  });

  it('gives the straight-line distance when walking is quicker', () => {
    expect(explainNoTrip('too-close', 180).message).toContain('180 m');
  });
});
