import { describe, expect, it } from 'vitest';
import { EAST, makeTestRoute, NORTH } from './testRoutes';
import { buildTripNetwork, findTrips, type RideLeg } from './tripPlanner';

const WEST_END = { lng: 123.885, lat: 10.3005 };
const EAST_END = { lng: 123.915, lat: 10.3005 };
const NORTH_END = { lng: 123.9005, lat: 10.325 };

const rides = (legs: { kind: string }[]) => legs.filter((l): l is RideLeg => l.kind === 'ride');

describe('findTrips', () => {
  const network = buildTripNetwork([EAST, NORTH]);

  it('finds a direct ride in the direction of travel', () => {
    const { options, reason } = findTrips(network, WEST_END, EAST_END);
    expect(reason).toBeNull();
    expect(options).toHaveLength(1);
    const option = options[0]!;
    expect(option.transfers).toBe(0);
    expect(option.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk']);

    const [ride] = rides(option.legs);
    expect(ride!.direction.code).toBe('EAST');
    // Stops are 250 m apart, so the nearest one is within about 125 m of each end.
    expect(ride!.board.lng).toBeCloseTo(WEST_END.lng, 2);
    expect(ride!.alight.lng).toBeCloseTo(EAST_END.lng, 2);
    expect(ride!.board.street).toBe('EAST Street');
    expect(option.rideM).toBeGreaterThan(3000);
    expect(option.rideM).toBeLessThan(3600);
    expect(option.walkM).toBeLessThan(350);
  });

  it('boards and leaves only at mapped stops', () => {
    const [ride] = rides(findTrips(network, WEST_END, EAST_END).options[0]!.legs);
    const stopIds = EAST.stops.map((s) => s.id);
    expect(stopIds).toContain(ride!.board.stop.id);
    expect(stopIds).toContain(ride!.alight.stop.id);
    // 250 m spacing means every boarding position is a multiple of 250 m along the route.
    expect(ride!.board.alongM % 250).toBe(0);
  });

  it('does not send a jeepney backwards along its route', () => {
    const { options, reason } = findTrips(network, EAST_END, WEST_END);
    expect(options).toEqual([]);
    expect(reason).toBe('no-connection');
  });

  it('finds a trip with one transfer where two routes cross', () => {
    const { options } = findTrips(network, WEST_END, NORTH_END);
    expect(options).toHaveLength(1);
    const option = options[0]!;
    expect(option.transfers).toBe(1);
    expect(option.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk', 'ride', 'walk']);

    const [first, second] = rides(option.legs);
    expect(first!.direction.code).toBe('EAST');
    expect(second!.direction.code).toBe('NORTH');
    // The change happens at the crossing, near (123.900, 10.300).
    expect(first!.alight.lng).toBeCloseTo(123.9, 2);
    expect(second!.board.lat).toBeCloseTo(10.3, 2);
    expect(second!.alight.lat).toBeCloseTo(NORTH_END.lat, 2);
    // The walk between the two stops is short.
    expect(option.legs[2]!.distanceM).toBeLessThan(150);
  });

  it('lists a direct ride before a trip with a transfer', () => {
    // LOOP reaches the same destination as EAST + NORTH without changing.
    const loop = makeTestRoute('LOOP', [
      [123.885, 10.301],
      [123.885, 10.326],
      [123.9, 10.326],
    ]);
    const withLoop = buildTripNetwork([EAST, NORTH, loop]);
    const { options } = findTrips(withLoop, WEST_END, NORTH_END);
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0]!.transfers).toBe(0);
    expect(rides(options[0]!.legs)[0]!.direction.code).toBe('LOOP');
    expect(options[1]!.transfers).toBe(1);
  });

  it('never offers a transfer between two directions of the same code', () => {
    const northAgain = makeTestRoute('EAST', NORTH.coordinates, { id: 'EAST-variant' });
    const sameCode = buildTripNetwork([EAST, northAgain]);
    expect(findTrips(sameCode, WEST_END, NORTH_END).options).toEqual([]);
  });

  it('cannot use a route that has no mapped stops', () => {
    const noStops = buildTripNetwork([makeTestRoute('EAST', EAST.coordinates, { stops: [] })]);
    expect(findTrips(noStops, WEST_END, EAST_END).reason).toBe('origin-not-served');
  });

  it('ignores a stop that is listed out of order', () => {
    const [first, second, third, ...rest] = EAST.stops;
    // The second stop claims to be "behind" the first: bad data.
    const jumbled = makeTestRoute('EAST', EAST.coordinates, {
      stops: [first!, { ...second!, alongM: -50 }, third!, ...rest],
    });
    const [ride] = rides(findTrips(buildTripNetwork([jumbled]), WEST_END, EAST_END).options[0]!.legs);
    expect(ride!.board.stop.id).not.toBe(second!.id);
  });

  it('says which end has no jeepney nearby', () => {
    const farAway = { lng: 123.95, lat: 10.4 };
    expect(findTrips(network, farAway, EAST_END).reason).toBe('origin-not-served');
    expect(findTrips(network, WEST_END, farAway).reason).toBe('destination-not-served');
  });

  it('accepts a longer walk when nothing is within the normal distance', () => {
    // About 780 m north of EAST: beyond the usual 500 m, inside the 1 km fallback.
    const insideCampus = { lng: 123.915, lat: 10.307 };
    const { options, reason } = findTrips(network, WEST_END, insideCampus);
    expect(reason).toBeNull();
    expect(options[0]!.walkM).toBeGreaterThan(700);
  });

  it('suggests walking when the two points are very close', () => {
    const next = { lng: WEST_END.lng + 0.001, lat: WEST_END.lat };
    const result = findTrips(network, WEST_END, next);
    expect(result.reason).toBe('too-close');
    expect(result.straightLineM).toBeLessThan(250);
  });

  it('counts the mapped stops passed during a ride', () => {
    const [ride] = rides(findTrips(network, WEST_END, EAST_END).options[0]!.legs);
    const expected = (ride!.alight.alongM - ride!.board.alongM) / 250 - 1;
    expect(ride!.stopsBetween).toHaveLength(expected);
  });
});
