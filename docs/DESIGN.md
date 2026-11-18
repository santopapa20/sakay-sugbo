# Design decisions

Why the app looks and behaves the way it does. Written before the interface was built and
updated after reviewing the running app.

## The idea in one sentence

**Cebu at night from above, with jeepney routes as lines of coloured light and route codes
shown like the painted signboards in a jeepney's windscreen.**

Three words: *nocturnal, legible, local.*

## Who it is for, and what follows from that

| Fact | Decision |
|---|---|
| A commuter standing on a street, on a phone, often in sunlight or a hurry | Phone layout first. Large touch targets (44 px). High-contrast text on near-opaque panels. |
| The question is always "which jeepney, from where?" | The route **code** is the biggest thing in every list and panel. |
| The map is the product | The map fills the screen. Interface floats on it and never covers more than half on a phone. |
| The data is community-mapped and unverified | Honesty is part of the design: a permanent "About the data" button, plain-language caveats, and "No ride could be confirmed" instead of a guess. |
| Mid-range phones | One map library, no extra 3D engine. The network is one cheap line layer. Motion is short and can be switched off. |

**Direction chosen:** a dark cartographic base with restrained mint and cyan accents, as
the brief asked for.
**Rejected alternative:** a light, paper-map look. It reads better in direct sun, but it
loses the "routes as light" idea and makes 3D buildings look heavy.
**Would change the choice:** user testing that shows the dark map is hard to read outdoors.
A light theme would then be worth adding.

*Note: the brief mentions an attached reference image. No image reached this project, so
the direction follows the brief's written description only.*

## Design tokens

All defined once in [`frontend/src/styles/index.css`](../frontend/src/styles/index.css).

**Colour**

| Token | Value | Used for |
|---|---|---|
| `night-900` | `#0B0F14` | Page and map background |
| `night-800` | `#121820` | Panels |
| `night-700` | `#1A222C` | Hover and selected rows |
| `night-600` / `night-500` | `#26313D` / `#3B4858` | Borders |
| `fog-100` | `#F2F5F7` | Main text |
| `fog-300` / `fog-400` / `fog-500` | `#C6CFD7` / `#9AA6B2` / `#8490A0` | Secondary, muted and label text |
| `mint-400` | `#72E6C1` | The one primary action per view; focus ring; active tab |
| `cyan-400` | `#48BFD1` | Places and category chips |
| `amber-400` | `#F2B55A` | Warnings and "not yet verified" |

Route colours are separate: one per number family (01, 03, 04 ...), tuned to stay readable
on the dark map. They are set in `tools/osm-import/import.mjs`.

**Type**

| Role | Face | Why |
|---|---|---|
| Route codes, headings, small capital labels | Barlow Condensed 600/700 | Drawn from road and transit signs; condensed capitals echo a jeepney signboard. |
| Everything else | Barlow 400/500/600 | Same family, very readable at 13 to 15 px. |
| Map labels | Noto Sans (from the tile provider) | Loaded by the map itself. |

Smallest text is 13 px; body is 15 px.

**Shape and depth:** radii of 3, 6, 10 and 14 px only. Panels are 94% opaque with a light
blur, so text never competes with the map. One shadow.

## Components

`RouteBadge` (the signboard), `Button`, `IconButton`, `PlaceCombobox` (search with
suggestions), `CategoryFilter`, `TabBar` / `BottomNav`, `BottomSheet`, `Modal`, `Toasts`,
`SkeletonList` (loading), `EmptyState`, `ErrorState`, `MapControls` (with the rotation
group), `ShareButton`, and floating map labels. Each lives in `frontend/src/components/` or beside the feature that owns it.

Every interactive component has hover, keyboard-focus, pressed and disabled states. Lists
have loading, empty and error states.

## Motion

| Moment | What moves | Why |
|---|---|---|
| Selecting a route | The line draws from its first stop to its last (0.7 to 1.6 s) while the camera turns to lay the route across the screen | Shows the direction of travel, and frames the route as large as possible |
| Choosing a trip | Each ride leg draws in its own colour | Shows the order of the legs |
| Panels, sheet, toasts | Short spring or 0.2 s fade | Shows where things came from |

Nothing loops or moves by itself except the loading shimmer and the pulse on "my location".
With the device's "reduce motion" setting on, lines appear at once, the camera jumps
instead of gliding, and both loops stop.

## Accessibility

- Everything works from the keyboard. Search is a proper combobox (arrows, Enter, Escape).
- Route details and trip steps are real text in ordered lists, so the map is never the
  only way to understand a route.
- One visible focus ring everywhere.
- Text colours were calculated to meet WCAG AA contrast (4.5 to 1) on their panel
  backgrounds. This has not yet been confirmed with an automated checker.
- The dialog uses the browser's `<dialog>`, which traps focus and closes on Escape.

## Review after building (same developer, not an independent review)

| Seen in the running app | Fix |
|---|---|
| Small labels had a line drawn over them: the class name `overline` collided with a Tailwind utility | Renamed to `eyebrow` |
| On a phone, a selected route was drawn tiny, because the visible strip of map is short and wide | The camera now rotates to lay the route across the screen; about twice as large |
| Opening a route showed the panel scrolled half-way down | The panel scrolls to the top whenever its content changes |
| Long direction names caused sideways scrolling in the panel | Fixed the shrinking rule on the direction list |
| The trip finder chose a transfer point on a flyover | Boarding, alighting and changing now happen only at mapped stops |
| Two directions of one code had identical labels | Labelled by first and last stop when the recorded terminals clash |

### Second pass, after adding rotation, links, "change here" and recent trips

| Seen in the running app | Fix |
|---|---|
| The map credit ("© OpenStreetMap") was black on the dark map, close to invisible. MapLibre's stylesheet loads later and was winning | Stronger selectors; now light text on a 90% dark background. Measured in the browser |
| Rotate buttons stacked vertically would have slid under the bottom sheet on a phone | One sideways group: left, compass, right. It adds no height and fits at 320 px |
| "Change here" listed the same code and destination twice for routes with variants | One row per code and destination |
| Links showed `%2C` instead of commas | Commas left readable; links are shorter |

Design choices in this pass:

- **The compass needle points north**, like a real one, and turns mint when the map is not
  facing north, so there is a visible reason to press it.
- **A link never says "my location".** If a trip started from your location, the copied link
  carries that spot as an ordinary pin, and the confirmation message says so before you share it.
- **Recent trips skip "my location" trips** entirely: the spot is stale by next time, and it
  should not sit in the browser's storage.
- **The address changes without adding history entries**, so Back still leaves the app in
  one press.

Still open: a selected place shows its name twice when its category is also switched on;
floating labels can be clipped at the screen edge on narrow phones.
