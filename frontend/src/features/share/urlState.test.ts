import { describe, expect, it } from 'vitest';
import { decodeUrlState, encodeUrlState, type UrlState } from './urlState';

const roundTrip = (state: UrlState) => decodeUrlState(`#${encodeUrlState(state)}`);

describe('url state', () => {
  it('is empty when nothing is open', () => {
    expect(encodeUrlState(null)).toBe('');
    expect(decodeUrlState('')).toBeNull();
    expect(decodeUrlState('#')).toBeNull();
  });

  it('keeps a selected route, with or without a stop', () => {
    expect(roundTrip({ kind: 'route', routeId: 'osm-21251275' })).toEqual({
      kind: 'route',
      routeId: 'osm-21251275',
    });
    expect(roundTrip({ kind: 'route', routeId: 'osm-1', stopId: 'osm-node-9' })).toEqual({
      kind: 'route',
      routeId: 'osm-1',
      stopId: 'osm-node-9',
    });
  });

  it('keeps a trip, including names with commas and accents', () => {
    const state: UrlState = {
      kind: 'trip',
      origin: { lng: 123.91814, lat: 10.31163, label: 'SM City Cebu', kind: 'place' },
      destination: { lng: 123.89310, lat: 10.3095, label: 'Fuente Osmeña, Cebu & more', kind: 'place' },
    };
    const back = roundTrip(state);
    expect(back).toMatchObject({
      kind: 'trip',
      origin: { lng: 123.91814, lat: 10.31163, label: 'SM City Cebu' },
      destination: { lng: 123.8931, lat: 10.3095, label: 'Fuente Osmeña, Cebu & more' },
    });
  });

  it('keeps a trip with only one end chosen', () => {
    const back = roundTrip({
      kind: 'trip',
      origin: null,
      destination: { lng: 123.9, lat: 10.3, label: 'There', kind: 'pin' },
    });
    expect(back).toMatchObject({ kind: 'trip', origin: null, destination: { label: 'There' } });
  });

  it('never passes on "my location" as such: the receiver gets an ordinary pin', () => {
    const back = roundTrip({
      kind: 'trip',
      origin: { lng: 123.9, lat: 10.3, label: 'My location', kind: 'me' },
      destination: null,
    });
    expect(back).toMatchObject({ kind: 'trip', origin: { kind: 'pin', label: 'Shared location' } });
  });

  it('rounds coordinates to about a metre', () => {
    expect(encodeUrlState({ kind: 'point', point: { lng: 123.893123456, lat: 10.309512345 } })).toBe(
      'at=10.30951,123.89312',
    );
  });

  it('writes a trip as a short, readable address', () => {
    expect(
      encodeUrlState({
        kind: 'trip',
        origin: { lng: 123.91814, lat: 10.31163, label: 'SM City Cebu', kind: 'place' },
        destination: null,
      }),
    ).toBe('from=10.31163,123.91814,SM+City+Cebu');
  });

  it('keeps a place and a tapped point', () => {
    expect(roundTrip({ kind: 'place', placeId: 'osm-way-42' })).toEqual({ kind: 'place', placeId: 'osm-way-42' });
    expect(roundTrip({ kind: 'point', point: { lng: 123.9, lat: 10.3 } })).toEqual({
      kind: 'point',
      point: { lng: 123.9, lat: 10.3 },
    });
  });

  it('ignores links that are damaged or impossible', () => {
    expect(decodeUrlState('#from=abc,def,Nowhere')).toBeNull();
    expect(decodeUrlState('#at=95,123.9')).toBeNull(); // latitude cannot be 95
    expect(decodeUrlState('#at=10.3')).toBeNull();
    expect(decodeUrlState('#something=else')).toBeNull();
  });
});
