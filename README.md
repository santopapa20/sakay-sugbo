# Sakay Sugbo

**A Cebu jeepney route finder on a 3D map of the city.**
Tell it where you are and where you are going; it tells you which jeepney code to ride
(04L, 13C, 01K ...), where to board, and where to change.

*Sakay* is Cebuano for "ride"; *Sugbo* is the Cebuano name for Cebu.

> **About the data.** Every route, stop and place comes from
> [OpenStreetMap](https://www.openstreetmap.org/copyright), a map made by volunteers.
> Nothing was typed in by hand or guessed. But **nobody on this project has yet checked
> the routes on the ground**, so treat the results as a guide and confirm with the
> signboard or the driver. Fares, schedules and travel times are not shown at all,
> because no verified source was found. Details: [docs/DATA.md](docs/DATA.md).

## What it does

| Feature | What you can do |
|---|---|
| **3D map of Cebu** | Real streets and real building footprints, tilted and lit. Pan, zoom, rotate, switch between 3D and flat. |
| **Route network** | 37 jeepney codes (74 directions) drawn over the city, coloured by route family. |
| **What passes here?** | Tap any spot: see every route within 300 m, how far away it is and on which street. |
| **Route details** | Pick a route: the line draws itself along the streets, the camera frames it, and the panel lists its direction, main streets and every mapped stop. |
| **Find a ride** | Choose a start and a destination (search, tap the map, or use your location). Get a direct ride or a ride with one change, as step-by-step text and on the map. |
| **Search** | Places, streets, stops and route codes. Works offline from the bundled data; no outside search service. |
| **Categories** | Show terminals, ports, schools, hospitals, shopping, government offices or landmarks on the map. |
| **Saved** | Star routes and places. They stay in your browser after a reload. No account. |
| **Phone layout** | Map first, search on top, details in a bottom sheet you can drag. |

## Run it

You need [Node.js](https://nodejs.org) 22 or newer (developed on Node 26). Nothing else: no database, no API key, no account.

```bash
cd frontend
```

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

Other commands (run inside `frontend/`):

| Command | What it does |
|---|---|
| `npm test` | Runs the 63 unit tests (distance maths, search, trip finder, favourites, wording). |
| `npm run typecheck` | Checks the TypeScript types without building. |
| `npm run build` | Type-checks, then builds the production site into `frontend/dist/`. |
| `npm run preview` | Serves the production build locally to check it. |

To refresh the route data from OpenStreetMap (from the project root):

```bash
node tools/osm-import/import.mjs --refresh
```

## How it is built

| Part | Technology | Why |
|---|---|---|
| Interface | React 19 + TypeScript + Vite | Standard, well-documented, fast to develop with. |
| Styling | Tailwind CSS 4, design tokens in one CSS file | Every colour and size has one source of truth. |
| Map | MapLibre GL JS 6 | Open-source, draws vector maps and 3D buildings on the GPU. |
| Base map tiles | [OpenFreeMap](https://openfreemap.org) | Free OpenStreetMap vector tiles. **No API key, no account, no billing.** |
| Shared state | Zustand | One small store; no boilerplate. |
| Motion | Motion (formerly Framer Motion) | Panel and toast transitions; respects "reduce motion". |
| Icons | Lucide | Consistent line icons. |
| Tests | Vitest | Runs the unit tests in under a second. |
| Backend | *Planned:* Java + Spring Boot | See below. |

### Folder map

```text
sakay-sugbo/
├── frontend/
│   ├── public/data/          routes, places and data facts (GeoJSON, generated)
│   └── src/
│       ├── types/            the shapes of the data (RouteDirection, Place ...)
│       ├── config.ts         app-wide settings: start view, walking distance ...
│       ├── utils/            distance and text helpers (no React, no map)
│       ├── services/         the ONLY place data is fetched from
│       ├── store/            shared state and the rules for changing it
│       ├── features/
│       │   ├── routes/       route questions + route list and detail screens
│       │   ├── search/       search index + the search box
│       │   ├── trip/         the trip finder + its screen and wording
│       │   ├── favorites/    saving to the browser + the Saved screen
│       │   ├── places/       category chips
│       │   ├── explore/      "what passes here?" screen
│       │   └── about/        "About the data" dialog
│       ├── map/              map style, layers, camera, controls, labels
│       ├── components/       reusable pieces: buttons, badge, sheet, dialog, toasts
│       └── styles/           design tokens and base styles
├── tools/osm-import/         script that turns OpenStreetMap data into the app's files
├── backend/                  plan and API contract for the Spring Boot service
└── docs/                     DATA.md (the data) and DESIGN.md (the design decisions)
```

The logic that matters most is plain TypeScript with no React in it, so it is easy to read and test:

- [`utils/geo.ts`](frontend/src/utils/geo.ts): distance between two points (haversine), nearest point on a line.
- [`features/trip/tripPlanner.ts`](frontend/src/features/trip/tripPlanner.ts): the trip finder.
- [`features/search/searchIndex.ts`](frontend/src/features/search/searchIndex.ts): search and ranking.
- [`features/routes/routeModel.ts`](frontend/src/features/routes/routeModel.ts): "which routes pass near this point?".

### How the trip finder works

1. A route can be boarded or left only at its **mapped stops**. (A point picked anywhere on
   the line could be on a flyover, where no jeepney can stop.)
2. Find the stops within walking distance (500 m) of the start and of the destination.
3. **Direct ride:** a route with a stop near the start and, *further along in its direction of
   travel*, a stop near the destination.
4. **One change:** a route near the start and a different route near the destination that
   have stops within 150 m of each other.
5. Rank by fewest changes, then by a cost in which a metre walked counts as four metres ridden.

If the mapped routes do not connect two points, the app says *"No ride could be confirmed"*.
It never invents one.

## The backend (next step)

The original plan puts the data and the trip finder behind a **Java + Spring Boot** REST API
with a real database. That part is **not built yet**, because Java was not installed on the
machine this was developed on, and unverifiable code is worse than none.

The frontend is ready for it: all data access goes through
[`services/dataService.ts`](frontend/src/services/dataService.ts) and
[`services/tripService.ts`](frontend/src/services/tripService.ts). When the API exists,
those two files change and nothing else does. The planned endpoints, tables and setup
steps are in [backend/README.md](backend/README.md).

## What has been checked, and what has not

Checked by running it (18 November 2026):

- `npm test`: 63 tests pass. `npm run typecheck` and `npm run build`: no errors.
- In a browser, development and production builds: the map loads with 3D buildings; tapping
  the map lists nearby routes; search finds places and route codes; a route opens, draws
  and lists its stops; a trip with one change is found and drawn; category chips show
  places; favourites survive a reload; a denied location permission shows a clear message;
  the "About the data" dialog opens and closes with Escape; the phone layout (470 px wide)
  and a desktop layout (1366 px wide) both render without sideways scrolling.

Not checked:

- **The routes themselves.** They are as mapped in OpenStreetMap; none was ridden.
- Location when permission is **granted** (the test browser always denies it).
- Real phones, Safari, Firefox, screen readers, and slow networks.
- Automated accessibility and performance measurements.

## Not done yet

- The Spring Boot backend and database (see above).
- Trips needing two changes.
- Fares and travel times (waiting for a verified source).
- Nine route codes that are mapped too roughly in OpenStreetMap to use (listed in
  [docs/DATA.md](docs/DATA.md)), and routes whose codes have no letter (for example 52, 60).
- Deployment.

## Credits and licences

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), Open Database Licence (ODbL).
- Base map tiles by [OpenFreeMap](https://openfreemap.org), using the OpenMapTiles schema.
- Fonts: Barlow and Barlow Condensed (SIL Open Font Licence).
