# The data

## Where it comes from

| What | Source | Licence |
|---|---|---|
| Jeepney routes, stops, places, street names | [OpenStreetMap](https://www.openstreetmap.org) via the Overpass API | Open Database Licence (ODbL) 1.0 |
| Base map (streets, water, building footprints and heights) | OpenStreetMap, served as vector tiles by [OpenFreeMap](https://openfreemap.org) | ODbL (data) |

No paid service, API key or account is used anywhere.

**Snapshot date:** OpenStreetMap data as of **18 November 2026**. The exact time is in
`frontend/public/data/meta.json` and is shown in the app's "About the data" dialog.

## Real versus demonstration data

| Data | Status |
|---|---|
| Route codes, route lines, stop names and positions | **Real**, as recorded by OpenStreetMap volunteers. **Not checked on the ground by this project.** |
| Places, addresses, street names | **Real**, from OpenStreetMap. |
| Building footprints and heights | **Real**, from OpenStreetMap. Where no height or floor count is recorded, the tile provider uses a low default, so some buildings look lower than they are. |
| Route colours | **Chosen by this project.** One colour per number family (01, 03, 04 ...), for readability only. They mean nothing official. |
| Fares, schedules, travel times | **Not included.** No verified source was found, so none are shown. |
| Demonstration or invented routes | **None in the app.** The only made-up routes are in `frontend/src/features/trip/testRoutes.ts`, used by unit tests and clearly labelled. |

Every route carries `"fieldVerified": false`. When someone has ridden a route and confirmed
it, that flag is the place to record it.

## What is covered

**37 route codes, 74 directions** (each direction of travel is a separate line, because
jeepneys often use different streets each way):

01B, 01C, 01K, 01Kx, 02B, 03A, 03B, 03L, 03Q, 04B, 04C, 04D, 04H, 04I, 04L, 04M, 06B, 06C,
06F, 06G, 06H, 07B, 08G, 09C, 09F, 09G, 10F, 10G, 10H, 10M, 11A, 13B, 13C, 20A, 21A, 22A, 22D.

Also imported: about 1,140 named places (terminals, ports, universities and colleges,
hospitals, malls and markets, government offices, landmarks, neighbourhoods) and about
1,890 street names, used for search and the category filters.

**Area:** latitude 10.24 to 10.40, longitude 123.82 to 123.97 (Cebu City, Mandaue, the edge
of Talisay and Lapu-Lapu).

## What is left out, and why

A route is imported only if **all** of these hold:

1. Its code looks like a city jeepney code: two digits and a letter (`04L`, `13C`, `01Kx`).
2. It is mapped one direction per line (OpenStreetMap "public transport version 2").
3. Its road pieces join end to end with no gap larger than 30 m.
4. It has at least two stops mapped.

Left out because of rules 2 to 4 (the reason for each is in `meta.json`):
**12D, 12G, 12I, 12L, 17B, 17C, 17D, 22I, 23D.**

Left out because of rule 1: codes without a letter (for example 23, 25, 44, 45, 52, 60),
`21D odd` / `21D even`, the Mactan `MI-` routes, MyBus, the BRT line and long-distance buses.

These are real services. They are missing from the app, not from Cebu.

## Known oddities in the source data

- Five codes (02B, 03B, 04C, 04D, 10G) have the same "from" and "to" recorded on more than
  one direction. The app notices this and labels those directions by their first and last
  stop instead.
- `04D` has four directions recorded, while `04H` and `04I` have one each. These look like
  variants via different streets whose codes may be mixed up in the source. The app shows
  them exactly as recorded and lists each one's main streets so they can be told apart.
  This is a good first candidate for a ground check.
- 3 of 1,686 stops are listed out of order along their route. The trip finder skips them.

## How to refresh or correct the data

To pull a newer snapshot (from the project root):

```bash
node tools/osm-import/import.mjs --refresh
```

The script prints every route it imports and every route it skips, with the reason.

**To fix a wrong route, fix it in OpenStreetMap**, not in this project's files (they are
generated and would be overwritten). Each route's page in the app links to its
OpenStreetMap entry. After your edit is saved there, run the command above.

## What real data is still needed

1. **Ground checks.** Ride each route, or check with drivers and cooperatives, and record
   what was confirmed and when.
2. **An official route list** from LTFRB Region VII, to find out which routes are missing.
3. **Fares.** The current LTFRB fare matrix, with its effective date.
4. **The nine roughly-mapped routes** above, re-mapped in OpenStreetMap.
5. **Building heights** for downtown Cebu, added in OpenStreetMap, for a truer skyline.
