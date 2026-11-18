# Sakay Sugbo backend

A Spring Boot REST API that stores the jeepney routes in a database, answers
"which routes pass near this point?", and finds trips with up to one change.

Java 21, Spring Boot 4.1, Spring Data JPA. Database: H2 in memory by default,
MySQL through a profile.

## Run it

You need a JDK, version 21 (17 or newer works). Maven is **not** needed: the
`mvnw` script in this folder downloads the right Maven the first time.

From this `backend` folder, in PowerShell or Command Prompt:

```bash
.\mvnw.cmd spring-boot:run
```

In Git Bash, macOS or Linux, use `./mvnw spring-boot:run` instead.

The API is then at <http://localhost:8080>. Try <http://localhost:8080/api/routes/near?lat=10.3095&lng=123.8931>
(Fuente Osmeña Circle).

To use it from the app, start the frontend in API mode from the `frontend` folder:

```bash
npm run dev:api
```

Run the tests:

```bash
.\mvnw.cmd test
```

If `mvnw` says it cannot find Java, open a new terminal (the installer changes
`PATH` only for terminals opened afterwards) or set `JAVA_HOME` to the JDK folder.

## Endpoints

| Request | Returns |
|---|---|
| `GET /api/routes` | Every route direction with its line, stops and streets |
| `GET /api/routes/near?lat=&lng=&radius=` | Routes passing within `radius` metres (default 300, allowed 1 to 5000), nearest first |
| `GET /api/places` | Every place, by name |
| `GET /api/places?category=hospital` | One category: `terminal`, `transport`, `education`, `hospital`, `shopping`, `government`, `landmark`, `area`, `street` |
| `GET /api/trips?fromLat=&fromLng=&toLat=&toLng=` | Trip options, fewest changes first. When there is none, `options` is empty and `reason` says why |
| `GET /api/meta` | Where the data came from, how fresh it is, what was left out |

A missing or impossible value (for example `lat=95`) gets `400 Bad Request`.
The JSON matches the TypeScript types in `frontend/src/types/index.ts`.

## How it is organised

```text
com.sakaysugbo
├── geo        GeoMath: haversine distance, nearest point on a line (no Spring)
├── route      Route entity and its tables; RouteCatalog (routes kept in memory);
│              NearbyRoutes (the "near" search); RouteController
├── place      Place entity, repository and controller
├── routing    TripPlanner (the trip finder, no Spring) and TripController
├── importer   GeoJsonImporter: fills the empty database at start-up
└── meta       MetaController: facts about the data
```

Three ideas worth understanding:

1. **The logic is separate from the framework.** `GeoMath`, `NearbyRoutes` and
   `TripPlanner` are plain Java with no Spring and no database, so their tests
   run in milliseconds and need nothing started.
2. **One copy of the data.** The GeoJSON files live in `frontend/public/data/`.
   The `<resources>` block in `pom.xml` copies them onto the backend's classpath,
   so the browser version and the server version can never drift apart.
3. **Routes are read from the database once, then kept in memory**
   (`RouteCatalog`). There are only 74 of them, and the "near" search needs every
   point of every route; reading 20,000 rows on every map tap would be wasteful.

### Tables

| Table | One row per | Columns |
|---|---|---|
| `route` | route direction | `id`, `code`, `name`, `terminal_from`, `terminal_to`, `first_stop_name`, `last_stop_name`, `operator`, `network`, `colour`, `length_m`, `osm_relation_id`, `field_verified` |
| `route_point` | point of a route's line | `route_id`, `sequence`, `latitude`, `longitude` |
| `route_stop` | mapped stop of a route | `route_id`, `sequence`, `osm_id`, `name`, `latitude`, `longitude`, `along_m` |
| `route_street` | stretch of a route on one street | `route_id`, `sequence`, `name`, `from_index` |
| `place` | searchable place | `id`, `name`, `category`, `address`, `lng`, `lat` |

Hibernate creates these from the entity classes at start-up.

### A bug worth knowing about

The first time the server was started for real, `/api/routes` returned an empty
list even though every test passed. The import was written as an
`ApplicationRunner`, and Spring opens the web port *before* runners finish. A
request arriving in that gap read an empty table and cached the result.

The fix is in `GeoJsonImporter`: it now implements `SmartInitializingSingleton`,
which Spring calls before the web server starts. The tests did not catch it
because a test only sends requests after start-up has fully finished.

## Database

**Default: H2 in memory.** Nothing to install. The data is re-imported every
time the server starts, which takes a few seconds. While the server runs you can
look at the tables at <http://localhost:8080/h2-console> (JDBC URL
`jdbc:h2:mem:sakaysugbo`, user `sa`, empty password).

**MySQL: set up but NOT yet tested**, because MySQL was not installed on the
development machine. After installing MySQL 8:

```bash
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=mysql"
```

Set the user name and password as environment variables first
(`SAKAY_DB_USER`, `SAKAY_DB_PASSWORD`). They are read from the environment so
that no password is ever written into a file that goes to GitHub. The settings
are in `src/main/resources/application-mysql.properties`.

## Tests

35 tests, all passing (run on 18 November 2026):

| Test class | What it checks |
|---|---|
| `GeoMathTest` (9) | Distance between known Cebu points, nearest point on a line, cutting a line |
| `NearbyRoutesTest` (4) | Radius, ordering, measuring to the line and not just its ends |
| `TripPlannerTest` (13) | Direct rides, direction of travel, one change, mapped stops only, honest "no trip" reasons |
| `ApiIntegrationTest` (9) | Starts the whole application, imports the real data, and calls every endpoint |

The Java trip finder was also compared with the TypeScript one in
`frontend/src/features/trip/tripPlanner.ts` on 300 pairs of real places: both
gave the same options for all 300.

## Not done yet

- MySQL has not been run (see above). PostgreSQL with PostGIS is a possible
  alternative if the data ever grows beyond one city.
- Place search still runs in the browser, over the list from `/api/places`.
- No login, rate limiting or CORS settings: the frontend reaches the API through
  the Vite dev proxy. These are needed before putting the API on the internet.
- Not deployed anywhere.
