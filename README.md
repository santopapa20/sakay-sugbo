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
| **3D map of Cebu** | Real streets and real building footprints, tilted and lit. Pan, zoom, switch between 3D and flat. A scale bar on wide screens. |
| **Rotate the map** | Turn-left and turn-right buttons (45° a press) with a compass between them: its needle always points north, and pressing it faces the map north again. Also two fingers on a phone, right-drag with a mouse, or Shift + arrow keys. |
| **Route network** | 37 jeepney codes (74 directions) drawn over the city, coloured by route family. |
| **What passes here?** | Tap any spot: see every route within 300 m, how far away it is and on which street. |
| **Route details** | Pick a route: the line draws itself along the streets, the camera frames it, and the panel lists its direction, main streets and every mapped stop. |
| **Change here** | Pick a stop on a route: see every other route you could change to within 150 m, and open one with a tap. |
| **Shareable links** | The web address always describes what is on screen (a route, a stop, a trip, a place). Copy it with the link button and whoever opens it sees the same thing. |
| **Recent trips** | The last five trips that found a ride are kept in your browser, one tap away. "Clear" removes them. |
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
| `npm test` | Runs the 81 unit tests (distance maths, search, trip finder, links, recent trips, favourites, wording). |
| `npm run dev:api` | Same app, but taking its data and trips from the Spring Boot backend (see below). |
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
| Backend | Java 21, Spring Boot 4, Spring Data JPA, H2 / MySQL | REST API; the trip finder also runs on the server. See below. |

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
│       │   ├── share/        links: turning the screen into an address and back
│       │   ├── places/       category chips
│       │   ├── explore/      "what passes here?" screen
│       │   └── about/        "About the data" dialog
│       ├── map/              map style, layers, camera, controls, labels
│       ├── components/       reusable pieces: buttons, badge, sheet, dialog, toasts
│       └── styles/           design tokens and base styles
├── tools/osm-import/         script that turns OpenStreetMap data into the app's files
├── backend/                  the Spring Boot API (Java): routes, places, trips
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

## The backend

A **Java 21 + Spring Boot 4** REST API in [`backend/`](backend/README.md). It stores the
routes in a database, answers "which routes pass near this point?", and finds trips using
the same rules as the browser, ported to Java.

The app can run in two ways, and looks identical in both:

| Mode | Start with | Where data and trips come from |
|---|---|---|
| **Static** (default) | `npm run dev` | GeoJSON files and the browser. No server, so it can be hosted anywhere, including GitHub Pages. |
| **API** | backend running, then `npm run dev:api` | The Spring Boot API on port 8080. |

To run the backend you need a JDK (21 recommended). From the `backend` folder:

```bash
.\mvnw.cmd spring-boot:run
```

Only two files know which mode is in use:
[`services/dataService.ts`](frontend/src/services/dataService.ts) and
[`services/tripService.ts`](frontend/src/services/tripService.ts). Endpoints, tables and
design notes are in [backend/README.md](backend/README.md).

The database is **H2 in memory** by default (nothing to install). A **MySQL 8** profile is
also there and tested; [backend/README.md](backend/README.md) has the four setup steps.

## What has been checked, and what has not

Checked by running it (18 November 2026):

- Frontend: `npm test`, 81 tests pass. `npm run typecheck` and `npm run build`: no errors.
- The newer features (rotate buttons and Shift + arrow keys, scale bar, "change here", links,
  recent trips) were driven in a headless Edge browser at 320, 412 and 1366 px wide, on the
  development and production builds, with no console errors. This included copying a link and
  reading it back from the clipboard, and opening damaged links, which are ignored.
- Backend: `mvnw test`, 35 tests pass, including 9 that start the whole application, import
  the real data and call every endpoint. Run on both H2 and MySQL 8.4.
- Backend on MySQL: started twice against a temporary MySQL server. The second start kept
  the data and imported nothing again. Also run as a limited database user.
- Backend started for real and called with `curl`: 74 routes returned, 20 route directions
  within 300 m of Fuente Osmeña, `400` for impossible coordinates, trips returned.
- The Java and TypeScript trip finders compared on 300 pairs of real places: same options
  for all 300.
- The app in API mode in a browser: routes, places and a trip with one change all came
  from the backend, with no errors in the console.
- In a browser, development and production builds: the map loads with 3D buildings; tapping
  the map lists nearby routes; search finds places and route codes; a route opens, draws
  and lists its stops; a trip with one change is found and drawn; category chips show
  places; favourites survive a reload; a denied location permission shows a clear message;
  the "About the data" dialog opens and closes with Escape; the phone layout (470 px wide)
  and a desktop layout (1366 px wide) both render without sideways scrolling.

Not checked:

- **The routes themselves.** They are as mapped in OpenStreetMap; none was ridden.
- **A permanent MySQL server.** MySQL was tested on a temporary server that was then
  deleted. The lasting one needs a root password, which only the owner should choose.
- Location when permission is **granted** (the test browser always denies it).
- Real phones, Safari, Firefox, screen readers, and slow networks.
- Automated accessibility and performance measurements.

## Not done yet

- Setting up the permanent MySQL server (four steps in [backend/README.md](backend/README.md)).
- Trips needing two changes.
- Fares and travel times (waiting for a verified source).
- Nine route codes that are mapped too roughly in OpenStreetMap to use (listed in
  [docs/DATA.md](docs/DATA.md)), and routes whose codes have no letter (for example 52, 60).
- Deployment.

## Credits and licences

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), Open Database Licence (ODbL).
- Base map tiles by [OpenFreeMap](https://openfreemap.org), using the OpenMapTiles schema.
- Fonts: Barlow and Barlow Condensed (SIL Open Font Licence).
