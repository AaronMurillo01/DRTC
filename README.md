# DRTC

**Distributed Real-Time Command & Control System**

DRTC is a browser based situational awareness console. It pulls live open data
from a handful of public sources, plots everything on a world map (flat, 3D
terrain, or a globe), scores it into a single threat picture, and lets you work
the whole thing from the keyboard. There are no API keys to set up and no
backend to run. Open it and it starts streaming.

![DRTC](docs/preview.png)

## What it does

- **One map, three views.** A 2D dark world map, a tilt-able 3D terrain map on a
  real globe projection, and a stylized globe. Switch with the header buttons or
  the keys `2`, `3`, `G`.
- **Live tracks.** Earthquakes, natural disasters, severe weather alerts, air
  quality, space weather, the ISS, and geopolitical signal hotspots are
  normalized into one event model and drawn as severity scaled points with hover
  details and click to focus.
- **Threat picture.** A correlation engine rolls the whole event stream into a
  Global Threat Index, a five level condition (NOMINAL up to CRITICAL), and a
  rolling history sparkline.
- **Instability index.** A proximity weighted stress score for 20 watch list
  countries, built from a geopolitical baseline plus nearby live events, with
  the top drivers called out per country.
- **Intel stream.** A ranked feed of every event with full text search and a
  minimum severity slider that filter both the list and the map.
- **SITREP.** A plain language situation summary generated from the current
  picture. No model calls, just rules over the live data.
- **Alerts.** New high severity tracks raise a dismissable toast and a header
  badge. A warm up pass keeps the first batch of historical events from flooding
  the log.
- **Markets radar.** Live prices and 24h moves for the major coins.

## About the scores

The Global Threat Index and the Instability Index are **heuristics built for
demonstration, not real intelligence assessments.** They combine open-source
event severity and density with a fixed geopolitical baseline and a distance
falloff. The weights are hand-tuned to produce a readable picture, not validated
against any ground truth. Treat them as a way to rank and visualize the live
feed, nothing more. The UI labels both panels as heuristic for the same reason.

## Design

The interface is a flat, pure black command console: hairline-bordered panels,
sharp corners, mono type, and subtle HUD framing. There is one accent color
(orange) and one rule for everything else: **color encodes severity, not
category.** Tracks, bars, gauges, and rings all move along the same four step
scale, so a glance reads as threat level rather than a legend of hues.

```
NOMINAL  slate   ·  MODERATE  amber  ·  HIGH  orange  ·  CRITICAL  red
```

Type is shown by short codes (SEIS, DSTR, WX, NEO) and the layer panel, not by
color. The result is a disciplined two tone system instead of a rainbow. Motion
is restrained and respects `prefers-reduced-motion`.

## Map toolbar

The strip on the right edge of the map adds:

- **SAT** to swap the dark basemap for satellite imagery.
- **HEAT** for a density heatmap of the live picture.
- **DAY/NIGHT** for a real time day and night terminator, recomputed every
  minute.
- **ORBIT** to slowly spin the earth, which pauses the moment you grab the map.
- **RADAR** for a live precipitation overlay (RainViewer).
- **RULER** to measure great circle range and bearing between points you click.

You also get a live MGRS and lat/lon readout under the cursor, a time range
filter (1h, 6h, 24h, 48h, 7d, ALL), a layer panel, great circle arcs that
connect the most unstable country to the events driving its score, and a live
**ISS ground track** that trails the station's recent path.

## More tools

- **Frame capture.** Export the current map view as a PNG from the Export menu,
  ready to drop into a report.
- **Audio alerts.** A speaker toggle in the header plays a short sonar tone when
  a new critical track appears, so you can run the board unattended.
- **Reports.** Export a formatted SITREP (Markdown) or the full common operating
  picture (JSON).

## Works on any screen

The layout adapts from a three column command wall on desktop down to a single
scrolling column on phones, with the map leading and the panels stacked below.
The header trims itself as space gets tight so the important controls always fit.

| Tablet | Phone |
| --- | --- |
| ![Tablet](docs/tablet.png) | ![Phone](docs/mobile.png) |

## Data sources

Everything here is free and needs no key.

| Layer | Source |
| --- | --- |
| Seismic | USGS earthquake feed |
| Disasters | NASA EONET |
| Weather alerts | NOAA / NWS (US) |
| Air quality | Open-Meteo (global cities) |
| Space weather | NOAA SWPC |
| ISS position | wheretheiss.at |
| Signals | GDELT |
| Near-Earth objects | NASA NeoWs |
| Precipitation radar | RainViewer |
| Markets | CoinGecko |
| Basemap | CARTO dark tiles (OpenStreetMap data) |
| Satellite | Esri World Imagery |
| Terrain | AWS Terrain Tiles |

Each feed runs on its own refresh schedule, retries with backoff, and drops to a
circuit breaker if a source keeps failing so it does not hammer a dead endpoint.

## Running it

```bash
npm install
npm run dev
```

That starts the dev server (usually on http://localhost:5173). Build a
production bundle with `npm run build` and serve it with `npm run preview`.

The app fetches all of its data straight from the public APIs in the browser, so
it needs an internet connection at runtime. There is nothing required to
configure. The only optional setting is `VITE_NASA_KEY`: the NASA feed uses the
shared `DEMO_KEY` by default, and you can drop in your own free key from
api.nasa.gov for higher rate limits.

## Stack

React, TypeScript, Vite, Tailwind, Zustand for state, MapLibre GL for the 2D and
3D map, and three.js (through react-globe.gl) for the stylized globe. The map and
globe engines are loaded on demand so the first paint stays light. The build also
ships as an installable PWA with offline caching of the app shell and basemap.

Tooling: Vitest for unit tests, ESLint and Prettier, and a GitHub Actions CI
workflow that type checks, lints, tests, and builds on every push.

## Engineering notes

A few things that go beyond a demo:

- **Resilient ingest.** Every feed has its own refresh cadence, retries with
  exponential backoff, and a per source circuit breaker that backs a failing
  source off (up to ten minutes) instead of hammering a dead endpoint. The
  System Health panel shows live latency, sync age, and failure counts.
- **Pure, tested parsers.** Each feed exposes a `parse()` function separate from
  its fetch, unit tested against real and malformed payloads, since upstream
  shape changes are the most likely break.
- **Isolation.** Error boundaries wrap every panel and the map engine, so one
  failing widget can't take down the console.
- **Graceful states.** Loading, all feeds offline, and empty filter results are
  all handled explicitly rather than showing a blank panel.

## Scripts

```bash
npm run dev          # dev server
npm run build        # type check and production build
npm run preview      # serve the production build
npm test             # unit tests in watch mode
npm run test:run     # unit tests once
npm run lint         # eslint
npm run typecheck    # tsc only, no emit
```

## How it is organized

```
src/
  services/        one file per feed (parse + fetch), plus the correlation
                   engine (threat.ts), shared geo math (geo.ts), and report
                   export (report.ts)
  hooks/useFeeds   feed polling, cadence, and the circuit breaker
  store.ts         app state (events, threat, filters, view mode, cursor)
  components/      header, panels, overlays
    map/           map style, layer defs, GeoJSON sources, toolbar
  *.test.ts        unit tests for the engine, store, and parsers
  types.ts         shared types
```

Data flow: `services/*` fetch and normalize into one `IntelEvent` model →
`useFeeds` ingests into the store on each source's cadence → `threat.ts`
recomputes the indices and SITREP → components render reactively.

Adding a layer is three steps: write a `parse()` plus `fetch()` in `services/`,
register it in `hooks/useFeeds.ts`, and add it to the source list and category
map in `store.ts`.

## License

MIT. See [LICENSE](LICENSE). Built on public open data, so check each provider's
terms and rate limits before you lean on them hard.
