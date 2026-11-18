/**
 * OpenStreetMap → app data import.
 *
 * What it does, in plain words:
 *   1. Asks the Overpass API (a free query service for OpenStreetMap) for the
 *      jeepney route "relations" mapped in Metro Cebu, plus their stops.
 *   2. Joins each route's road pieces into one ordered line, in the direction
 *      of travel, and refuses any route whose pieces do not join up cleanly.
 *   3. Asks for named places (terminals, hospitals, malls ...) and street names
 *      so the app has something real to search.
 *   4. Writes GeoJSON files into frontend/public/data/.
 *
 * Nothing here is typed in by hand: every route code, stop and line comes
 * from OpenStreetMap contributors (licence: ODbL). It is community-mapped
 * data, so it can still be wrong or out of date. See docs/DATA.md.
 *
 * Run:  node tools/osm-import/import.mjs            (uses the cache if present)
 *       node tools/osm-import/import.mjs --refresh  (downloads again)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, '.cache');
const OUT_DIR = join(HERE, '..', '..', 'frontend', 'public', 'data');
const REFRESH = process.argv.includes('--refresh');

/** South, west, north, east. Covers Cebu City, Mandaue and the edge of Talisay. */
const BBOX = [10.24, 123.82, 10.4, 123.97];
const BBOX_TEXT = BBOX.join(',');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Jeepney codes look like 04L, 13C, 01Kx. Long-distance buses do not. */
const JEEPNEY_CODE = /^\d{2}[A-Z]x?$/;
/** Road pieces further apart than this mean the route is broken in OSM. */
const MAX_JOIN_GAP_METRES = 30;
/** A stop further than this from the line is not treated as being on that part of the route. */
const MAX_STOP_OFFSET_METRES = 45;
/** Reject a server whose copy of OpenStreetMap is older than this. */
const MAX_SNAPSHOT_AGE_DAYS = 14;

// ---------------------------------------------------------------- helpers

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two {lat, lon} points. */
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const samePoint = (a, b) => haversine(a, b) < 1;

async function overpass(name, query) {
  const cacheFile = join(CACHE_DIR, `${name}.json`);
  if (!REFRESH && existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  let lastError;
  // The public servers are often busy, so go round them a few times.
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        console.log(`  fetching ${name} from ${new URL(endpoint).host} (try ${attempt}) ...`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'cebu-jeepney-route-import/0.1',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(150_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        // Some mirrors lag far behind. Refuse a snapshot that is too old.
        const snapshot = Date.parse(json.osm3s?.timestamp_osm_base ?? '');
        const ageDays = (Date.now() - snapshot) / 86_400_000;
        if (!(ageDays < MAX_SNAPSHOT_AGE_DAYS)) {
          throw new Error(`stale snapshot (${json.osm3s?.timestamp_osm_base ?? 'no date'})`);
        }
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(cacheFile, JSON.stringify(json));
        return json;
      } catch (error) {
        lastError = error;
        console.log(`    failed: ${error.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 15_000));
  }
  throw new Error(`Could not fetch "${name}": ${lastError?.message}`);
}

// ------------------------------------------------------- route geometry

/** Index of the point in `points` closest to `target`. */
function nearestIndex(points, target) {
  let best = 0;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const d = haversine(point, target);
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}

const isClosed = (g) => g.length > 3 && samePoint(g[0], g[g.length - 1]);

/** Smallest distance from `point` to either end of a way (or any point of a roundabout). */
function distanceToWay(point, way) {
  if (isClosed(way)) return haversine(point, way[nearestIndex(way, point)]);
  return Math.min(haversine(point, way[0]), haversine(point, way[way.length - 1]));
}

/**
 * Joins the road pieces ("ways") of a route into one line.
 *
 * OpenStreetMap stores a route as an ordered list of ways, but each way keeps
 * its own drawing direction, so some must be flipped. A roundabout is stored
 * as a closed ring; we only keep the arc the jeepney actually drives.
 */
function stitchWays(ways) {
  const line = [];
  /** Which way each line point came from, so we can name the street later. */
  const wayIdAt = [];
  const gaps = [];

  const push = (points, wayId) => {
    for (const point of points) {
      if (line.length && samePoint(line[line.length - 1], point)) continue;
      line.push(point);
      wayIdAt.push(wayId);
    }
  };

  ways.forEach((way, i) => {
    const geometry = way.geometry;
    const next = ways[i + 1]?.geometry;
    const end = line[line.length - 1];

    if (isClosed(geometry)) {
      const ring = geometry.slice(0, -1); // drop the repeated closing point
      const entry = end ? nearestIndex(ring, end) : 0;
      let exit = entry;
      if (next) {
        // The exit is the ring point closest to where the next way starts.
        const nextEnds = isClosed(next) ? next : [next[0], next[next.length - 1]];
        let best = Infinity;
        ring.forEach((point, index) => {
          for (const candidate of nextEnds) {
            const d = haversine(point, candidate);
            if (d < best) {
              best = d;
              exit = index;
            }
          }
        });
      }
      const arc = [];
      for (let k = entry; ; k = (k + 1) % ring.length) {
        arc.push(ring[k]);
        if (k === exit) break;
      }
      if (end) {
        const gap = haversine(end, arc[0]);
        if (gap > MAX_JOIN_GAP_METRES) gaps.push(Math.round(gap));
      }
      push(arc, way.ref);
      return;
    }

    let oriented = geometry;
    if (!end) {
      // First way: point it so that its far end touches the second way.
      if (next) {
        const startToNext = distanceToWay(geometry[0], next);
        const endToNext = distanceToWay(geometry[geometry.length - 1], next);
        if (startToNext < endToNext) oriented = [...geometry].reverse();
      }
    } else {
      const toStart = haversine(end, geometry[0]);
      const toEnd = haversine(end, geometry[geometry.length - 1]);
      if (toEnd < toStart) oriented = [...geometry].reverse();
      const gap = Math.min(toStart, toEnd);
      if (gap > MAX_JOIN_GAP_METRES) gaps.push(Math.round(gap));
    }
    push(oriented, way.ref);
  });

  return { line, wayIdAt, gaps };
}

/** Distance along the line (metres) at each point. */
function cumulativeDistances(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversine(line[i - 1], line[i]));
  return out;
}

/** Closest point on one straight piece of the line (a to b) to `target`. */
function projectOnSegment(a, b, target) {
  // Treat longitude/latitude as flat x/y. Fine over a few hundred metres,
  // as long as longitude is scaled by cos(latitude).
  const scale = Math.cos(toRad(target.lat));
  const dx = (b.lon - a.lon) * scale;
  const dy = b.lat - a.lat;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (((target.lon - a.lon) * scale) * dx + (target.lat - a.lat) * dy) / lengthSquared));
  const point = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  return { t, offM: haversine(point, target) };
}

/**
 * Works out how far along the route each stop is.
 *
 * Stops are listed in travel order, so each one is looked for AHEAD of the
 * previous one. That matters where a route passes the same street twice:
 * taking simply "the nearest point on the line" could put a stop on the
 * wrong pass. A stop that cannot be found ahead falls back to the nearest
 * point anywhere, and the trip finder later ignores it as out of order.
 */
function placeStopsAlongLine(line, along, members) {
  let fromSegment = 0;
  return members.map((member) => {
    let found = null;
    for (let i = fromSegment; i < line.length - 1; i++) {
      const { t, offM } = projectOnSegment(line[i], line[i + 1], member);
      if (found && offM > found.offM) break; // moving away again: the previous piece was the closest
      if (offM <= MAX_STOP_OFFSET_METRES && (!found || offM < found.offM)) found = { i, t, offM };
    }
    if (found) {
      fromSegment = found.i;
    } else {
      for (let i = 0; i < line.length - 1; i++) {
        const { t, offM } = projectOnSegment(line[i], line[i + 1], member);
        if (!found || offM < found.offM) found = { i, t, offM };
      }
    }
    return {
      alongM: Math.round(along[found.i] + (along[found.i + 1] - along[found.i]) * found.t),
      offLineM: Math.round(found.offM),
    };
  });
}

/** Turns the per-point way ids into ordered street stretches: [{ name, fromIndex }]. */
function streetStretches(wayIdAt, wayTags) {
  const stretches = [];
  wayIdAt.forEach((wayId, index) => {
    const tags = wayTags.get(wayId) ?? {};
    const name = tags.name ?? null;
    const last = stretches[stretches.length - 1];
    if (!last || last.name !== name) stretches.push({ name, fromIndex: index });
  });
  return stretches;
}

/** One colour per route number family (01, 03, 04 ...), tuned to read on a dark map. */
const FAMILY_COLOURS = {
  '01': '#F2A65A',
  '02': '#E8C468',
  '03': '#7FD6A2',
  '04': '#5CC8E8',
  '06': '#B79CF2',
  '07': '#F28FB1',
  '08': '#F2D36B',
  '09': '#8FB8F5',
  '10': '#6FDCC4',
  '11': '#F0957A',
  '13': '#A9E06B',
  '20': '#E79AE0',
  '21': '#7CC6F2',
  '22': '#F5B971',
};
const FALLBACK_COLOUR = '#9AA6B2';

// ------------------------------------------------------------------ routes

async function importRoutes() {
  const data = await overpass(
    'routes',
    `[out:json][timeout:180];
     relation["type"="route"]["route"="bus"](${BBOX_TEXT})->.r;
     .r out geom;
     node(r.r); out;
     way(r.r); out tags;`,
  );

  const relations = data.elements.filter((e) => e.type === 'relation');
  const nodeTags = new Map(
    data.elements.filter((e) => e.type === 'node').map((e) => [e.id, e.tags ?? {}]),
  );
  const wayTags = new Map(
    data.elements.filter((e) => e.type === 'way').map((e) => [e.id, e.tags ?? {}]),
  );

  const features = [];
  const skipped = [];

  for (const relation of relations) {
    const tags = relation.tags ?? {};
    const code = tags.ref ?? '';
    if (!JEEPNEY_CODE.test(code)) continue; // long-distance buses, MyBus, BRT ...

    const describe = `${code} (relation ${relation.id})`;
    const ways = relation.members.filter(
      (m) => m.type === 'way' && m.geometry && !/platform|stop/.test(m.role ?? ''),
    );
    const stopMembers = relation.members.filter(
      (m) => m.type === 'node' && /platform|stop/.test(m.role ?? ''),
    );

    if (tags['public_transport:version'] !== '2') {
      skipped.push({ code, relation: relation.id, reason: 'old mapping style, both directions mixed in one line' });
      continue;
    }
    const { line, wayIdAt, gaps } = stitchWays(ways);
    if (gaps.length) {
      skipped.push({ code, relation: relation.id, reason: `road pieces do not join (gaps of ${gaps.join(', ')} m)` });
      continue;
    }
    if (stopMembers.length < 2) {
      skipped.push({ code, relation: relation.id, reason: 'no stops mapped' });
      continue;
    }
    const outside = line.some(
      (p) => p.lat < BBOX[0] - 0.05 || p.lat > BBOX[2] + 0.05 || p.lon < BBOX[1] - 0.05 || p.lon > BBOX[3] + 0.05,
    );
    if (outside) {
      skipped.push({ code, relation: relation.id, reason: 'leaves the covered area' });
      continue;
    }

    const along = cumulativeDistances(line);
    const positions = placeStopsAlongLine(line, along, stopMembers);
    const stops = stopMembers.map((member, i) => ({
      id: `osm-node-${member.ref}`,
      name: nodeTags.get(member.ref)?.name ?? null,
      lng: round6(member.lon),
      lat: round6(member.lat),
      /** Metres from the start of the route to this stop. */
      alongM: positions[i].alongM,
      offLineM: positions[i].offLineM,
    }));

    // Sanity check: stops are listed start → end, so their positions along the
    // line should mostly increase. If they mostly decrease we stitched backwards.
    let increasing = 0;
    for (let i = 1; i < stops.length; i++) if (stops[i].alongM >= stops[i - 1].alongM) increasing++;
    if (stops.length > 2 && increasing < (stops.length - 1) / 2) {
      skipped.push({ code, relation: relation.id, reason: 'stop order disagrees with the line direction' });
      continue;
    }

    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];
    features.push({
      type: 'Feature',
      properties: {
        id: `osm-${relation.id}`,
        code,
        name: tags.name ?? null,
        // Terminals exactly as tagged in OpenStreetMap; null when not recorded.
        from: tags.from ?? null,
        to: tags.to ?? null,
        firstStopName: firstStop.name,
        lastStopName: lastStop.name,
        operator: tags.operator ?? null,
        network: tags.network ?? null,
        colour: FAMILY_COLOURS[code.slice(0, 2)] ?? FALLBACK_COLOUR,
        lengthM: Math.round(along[along.length - 1]),
        streets: streetStretches(wayIdAt, wayTags),
        stops: stops.map(({ offLineM, ...stop }) => stop),
        source: 'openstreetmap',
        osmRelationId: relation.id,
        /** Nobody on this project has ridden the route to confirm it. */
        fieldVerified: false,
      },
      geometry: {
        type: 'LineString',
        coordinates: line.map((p) => [round6(p.lon), round6(p.lat)]),
      },
    });
    console.log(
      `  ok  ${describe.padEnd(28)} ${String(line.length).padStart(4)} pts  ${(along.at(-1) / 1000).toFixed(1).padStart(5)} km  ${stops.length} stops (${stops.filter((s) => s.name).length} named)`,
    );
  }

  features.sort(
    (a, b) => a.properties.code.localeCompare(b.properties.code) || a.properties.osmRelationId - b.properties.osmRelationId,
  );
  return { features, skipped, osmTimestamp: data.osm3s?.timestamp_osm_base ?? null };
}

// ------------------------------------------------------------------ places

/** Each rule: an Overpass filter and the app category it becomes. */
const PLACE_RULES = [
  { category: 'terminal', filter: '["amenity"="bus_station"]' },
  { category: 'transport', filter: '["amenity"="ferry_terminal"]' },
  { category: 'transport', filter: '["aeroway"="terminal"]' },
  { category: 'education', filter: '["amenity"~"^(university|college)$"]' },
  { category: 'hospital', filter: '["amenity"="hospital"]' },
  { category: 'shopping', filter: '["shop"~"^(mall|department_store)$"]' },
  { category: 'shopping', filter: '["amenity"="marketplace"]' },
  { category: 'government', filter: '["amenity"~"^(townhall|courthouse)$"]' },
  { category: 'government', filter: '["office"="government"]' },
  { category: 'landmark', filter: '["tourism"~"^(attraction|museum)$"]' },
  { category: 'landmark', filter: '["historic"~"^(monument|memorial|fort|church|castle)$"]' },
  // Every pocket park and basketball court is tagged leisure=park, so only
  // keep the well-known ones: those that have a Wikidata or Wikipedia entry.
  { category: 'landmark', filter: '["leisure"="park"]', only: (tags) => Boolean(tags.wikidata || tags.wikipedia) },
  { category: 'area', filter: '["place"~"^(suburb|quarter|neighbourhood|village)$"]' },
];

function matchesRule(tags, rule) {
  const match = rule.filter.match(/^\["([^"]+)"(=|~)"([^"]+)"\]$/);
  const [, key, operator, value] = match;
  if (tags[key] === undefined) return false;
  if (rule.only && !rule.only(tags)) return false;
  return operator === '=' ? tags[key] === value : new RegExp(value).test(tags[key]);
}

async function importPlaces() {
  const body = PLACE_RULES.map((rule) => `nwr${rule.filter}["name"](${BBOX_TEXT});`).join('\n');
  const data = await overpass('places', `[out:json][timeout:180];(\n${body}\n);out center tags;`);

  const seen = new Set();
  const features = [];
  for (const element of data.elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || !tags.name) continue;
    const rule = PLACE_RULES.find((r) => matchesRule(tags, r));
    if (!rule) continue;
    // The same mall is often mapped as both a building and a point.
    const key = `${rule.category}|${tags.name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    features.push({
      type: 'Feature',
      properties: {
        id: `osm-${element.type}-${element.id}`,
        name: tags.name,
        category: rule.category,
        address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || null,
        source: 'openstreetmap',
      },
      geometry: { type: 'Point', coordinates: [round6(lon), round6(lat)] },
    });
  }
  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  return features;
}

// ----------------------------------------------------------------- streets

async function importStreets() {
  const data = await overpass(
    'streets',
    `[out:json][timeout:180];
     way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"]["name"](${BBOX_TEXT});
     out center tags;`,
  );
  // A street is many short ways. Keep one search entry per name: the piece
  // nearest the middle of all its pieces.
  const byName = new Map();
  for (const way of data.elements) {
    if (!way.center) continue;
    const list = byName.get(way.tags.name) ?? [];
    list.push({ lat: way.center.lat, lon: way.center.lon });
    byName.set(way.tags.name, list);
  }
  const features = [];
  for (const [name, pieces] of byName) {
    const middle = {
      lat: pieces.reduce((sum, p) => sum + p.lat, 0) / pieces.length,
      lon: pieces.reduce((sum, p) => sum + p.lon, 0) / pieces.length,
    };
    const best = pieces[nearestIndex(pieces, middle)];
    features.push({
      type: 'Feature',
      properties: {
        id: `street-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        category: 'street',
        address: null,
        source: 'openstreetmap',
      },
      geometry: { type: 'Point', coordinates: [round6(best.lon), round6(best.lat)] },
    });
  }
  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  return features;
}

// -------------------------------------------------------------------- main

console.log('Importing Cebu jeepney data from OpenStreetMap');
const { features: routes, skipped, osmTimestamp } = await importRoutes();
const places = await importPlaces();
const streets = await importStreets();

const meta = {
  source: 'OpenStreetMap contributors',
  licence: 'Open Database Licence (ODbL) 1.0',
  licenceUrl: 'https://www.openstreetmap.org/copyright',
  /** When the OpenStreetMap database snapshot we read was current. */
  osmDataTimestamp: osmTimestamp,
  importedAt: new Date().toISOString(),
  boundingBox: { south: BBOX[0], west: BBOX[1], north: BBOX[2], east: BBOX[3] },
  fieldVerified: false,
  note:
    'Community-mapped data imported without changes to route codes, stops or geometry. ' +
    'Not checked on the ground by this project. Fares and schedules are not included because no verified source was found.',
  counts: {
    routeDirections: routes.length,
    routeCodes: new Set(routes.map((f) => f.properties.code)).size,
    places: places.length,
    streets: streets.length,
  },
  skippedRoutes: skipped,
};

await mkdir(OUT_DIR, { recursive: true });
const write = (file, value) => writeFile(join(OUT_DIR, file), JSON.stringify(value));
await write('routes.geojson', { type: 'FeatureCollection', features: routes });
await write('places.geojson', { type: 'FeatureCollection', features: [...places, ...streets] });
await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

console.log(`\nWrote ${routes.length} route directions (${meta.counts.routeCodes} codes), ${places.length} places, ${streets.length} streets.`);
console.log(`Skipped ${skipped.length} jeepney relations:`);
for (const s of skipped) console.log(`  -  ${s.code.padEnd(6)} relation ${s.relation}: ${s.reason}`);
