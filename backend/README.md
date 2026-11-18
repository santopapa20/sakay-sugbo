# Backend (planned, not built yet)

This folder is a plan, not code. The Spring Boot service was **not** written in the first
pass because Java was not installed on the development machine, and code that has never
been compiled or run should not be presented as working.

The app works today without it: the frontend reads the GeoJSON files in
`frontend/public/data/` and finds trips in the browser.

## Before starting

Install these (none was found on the machine on 18 November 2026):

| Tool | Version | Notes |
|---|---|---|
| Java (JDK) | 21 (17 or newer works) | For example Eclipse Temurin. Maven itself is not needed: the project will use the Maven wrapper (`mvnw`). |
| A database | MySQL 8 **or** PostgreSQL 16 | See "Database choice" below. An in-memory H2 profile can cover development before either is installed. |

## What the service will do

1. **Import** `routes.geojson` and `places.geojson` at start-up, if its tables are empty.
2. **Serve** the data to the frontend.
3. **Find trips**, by porting `frontend/src/features/trip/tripPlanner.ts` to Java. That
   file is plain logic with unit tests, so the port can be checked test by test.

## Planned endpoints

| Method and path | Returns | Replaces in the frontend |
|---|---|---|
| `GET /api/routes` | Every route direction with its points and stops | `dataService.getRoutes()` |
| `GET /api/routes/near?lat=&lng=&radius=` | Routes passing within `radius` metres (default 300) | `routesNear()` in `routeModel.ts` |
| `GET /api/places?category=` | Places, optionally one category | `dataService.getPlaces()` |
| `GET /api/places/search?q=` | Ranked search results | `search()` in `searchIndex.ts` |
| `GET /api/trips?fromLat=&fromLng=&toLat=&toLng=` | Trip options, fewest changes first | `planTrip()` in `tripService.ts` |
| `GET /api/meta` | Data source, snapshot date, counts | `dataService.getMeta()` |

The JSON shapes are the TypeScript types in `frontend/src/types/index.ts`.
The Vite dev server already forwards `/api` to `http://localhost:8080`.

## Planned tables

| Table | Columns |
|---|---|
| `route` | `id`, `code`, `name`, `origin`, `destination`, `operator`, `colour`, `length_m`, `osm_relation_id`, `field_verified` |
| `route_point` | `route_id`, `sequence`, `latitude`, `longitude` |
| `route_stop` | `route_id`, `sequence`, `osm_node_id`, `name`, `latitude`, `longitude`, `along_m` |
| `place` | `id`, `name`, `category`, `address`, `latitude`, `longitude` |

## Planned package layout

```text
com.sakaysugbo
├── route      Route, RoutePoint, RouteStop entities; repository; controller
├── place      Place entity; repository; search; controller
├── routing    the trip finder (ported from tripPlanner.ts) and its tests
├── geo        haversine distance and nearest-point-on-line, with tests
└── importer   reads the GeoJSON files into the tables at start-up
```

## Database choice

Two reasonable options. This is the project owner's decision:

- **MySQL**: the stack the owner already knows best. Distance checks are done in Java
  (haversine), which is plenty at this size (about 20,000 route points).
- **PostgreSQL + PostGIS**: has built-in geographic queries ("routes within 300 m" becomes
  one SQL call). Worth it if the data grows to a whole region.

Either way, the first tests to write are the same ones the frontend already has: the
distance function, "routes near a point", and the trip finder.
