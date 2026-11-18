/**
 * Search over the data we actually have: places, streets, stops and route
 * codes. Nothing is sent to an outside service, so there is no API key, no
 * usage limit, and a result always has a real position on the map.
 */
import type { LngLat, Place, PlaceCategory, RouteDirection } from '../../types';
import { normalise } from '../../utils/text';

export type SearchResult =
  | { kind: 'place'; id: string; title: string; subtitle: string; place: Place }
  | { kind: 'stop'; id: string; title: string; subtitle: string; position: LngLat }
  | { kind: 'route'; id: string; title: string; subtitle: string; code: string };

interface IndexEntry {
  result: SearchResult;
  /** The searchable text, already normalised. */
  text: string;
  words: string[];
  /** Tie-breaker: well-known kinds of place come before side streets. */
  weight: number;
}

export interface SearchIndex {
  entries: IndexEntry[];
}

const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  terminal: 'Terminal',
  transport: 'Port or transport hub',
  education: 'School',
  hospital: 'Hospital',
  shopping: 'Shopping',
  government: 'Government office',
  landmark: 'Landmark',
  area: 'Neighbourhood',
  street: 'Street',
};

const CATEGORY_WEIGHT: Record<PlaceCategory, number> = {
  shopping: 9,
  terminal: 9,
  transport: 8,
  education: 8,
  hospital: 8,
  landmark: 7,
  area: 7,
  government: 6,
  street: 4,
};

export const categoryLabel = (category: PlaceCategory) => CATEGORY_LABEL[category];

function entry(result: SearchResult, weight: number, extraText = ''): IndexEntry {
  const text = normalise(`${result.title} ${extraText}`);
  return { result, text, words: text.split(' '), weight };
}

export function buildSearchIndex(places: Place[], routes: RouteDirection[]): SearchIndex {
  const entries: IndexEntry[] = [];

  for (const place of places) {
    entries.push(
      entry(
        {
          kind: 'place',
          id: place.id,
          title: place.name,
          subtitle: [CATEGORY_LABEL[place.category], place.address].filter(Boolean).join(' · '),
          place,
        },
        CATEGORY_WEIGHT[place.category],
      ),
    );
  }

  // One entry per route code, however many directions it has.
  const codes = new Map<string, RouteDirection[]>();
  for (const route of routes) codes.set(route.code, [...(codes.get(route.code) ?? []), route]);
  for (const [code, directions] of codes) {
    const name = directions.find((d) => d.name)?.name ?? '';
    entries.push(
      entry(
        { kind: 'route', id: `route-${code}`, title: code, subtitle: name || 'Jeepney route', code },
        // Typing a code ("13c") still puts the route first, because the text
        // starts with the code. This lower weight only matters when the match
        // is on the route's name, where the place itself should win.
        6,
        name,
      ),
    );
  }

  // Named stops, once each: many routes share the same stop.
  const stops = new Map<string, { name: string; position: LngLat; codes: Set<string> }>();
  for (const route of routes) {
    for (const stop of route.stops) {
      if (!stop.name) continue;
      const known = stops.get(stop.id) ?? {
        name: stop.name,
        position: { lng: stop.lng, lat: stop.lat },
        codes: new Set<string>(),
      };
      known.codes.add(route.code);
      stops.set(stop.id, known);
    }
  }
  for (const [id, stop] of stops) {
    entries.push(
      entry(
        {
          kind: 'stop',
          id,
          title: stop.name,
          subtitle: `Jeepney stop · ${[...stop.codes].sort().join(', ')}`,
          position: stop.position,
        },
        5,
      ),
    );
  }

  return { entries };
}

/**
 * How well one entry matches the query. 0 means "not a match".
 * Every word typed must appear; matches at the start of the name rank highest.
 */
function score(candidate: IndexEntry, query: string, queryWords: string[]): number {
  if (candidate.text === query) return 100;
  if (candidate.text.startsWith(query)) return 80;

  let total = 0;
  for (const word of queryWords) {
    if (candidate.words.some((w) => w.startsWith(word))) total += 60;
    else if (candidate.text.includes(word)) total += 30;
    else return 0;
  }
  return total / queryWords.length;
}

export function search(index: SearchIndex, rawQuery: string, limit = 8): SearchResult[] {
  const query = normalise(rawQuery);
  if (!query) return [];
  const queryWords = query.split(' ');

  const matches: { candidate: IndexEntry; points: number }[] = [];
  for (const candidate of index.entries) {
    const points = score(candidate, query, queryWords);
    if (points > 0) matches.push({ candidate, points });
  }

  matches.sort(
    (a, b) =>
      b.points - a.points ||
      b.candidate.weight - a.candidate.weight ||
      a.candidate.text.length - b.candidate.text.length ||
      a.candidate.text.localeCompare(b.candidate.text),
  );

  // The same name can exist twice (a mall mapped as a shop and as a landmark).
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const { candidate } of matches) {
    const key = `${candidate.result.kind}|${candidate.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(candidate.result);
    if (results.length === limit) break;
  }
  return results;
}
