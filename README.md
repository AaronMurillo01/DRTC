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
- **Live tracks.** Earthquakes, natural disasters, space weather, the ISS, and
  geopolitical signal hotspots are normalized into one event model and drawn as
  severity scaled points with hover details and click to focus.
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

## Map toolbar

The strip on the right edge of the map adds:

- **SAT** to swap the dark basemap for satellite imagery.
- **HEAT** for a density heatmap of the live picture.
- **DAY/NIGHT** for a real time day and night terminator, recomputed every
  minute.
- **ORBIT** to slowly spin the earth, which pauses the moment you grab the map.

You also get a live MGRS and lat/lon readout under the cursor, a time range
filter (1h, 6h, 24h, 48h, 7d, ALL), a layer panel, and great circle arcs that
connect the most unstable country to the events driving its score.

## Data sources

Everything here is free and needs no key.

| Layer | Source |
| --- | --- |
| Seismic | USGS earthquake feed |
| Disasters | NASA EONET |
| Space weather | NOAA SWPC |
| ISS position | wheretheiss.at |
| Signals | GDELT |
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
it needs an internet connection at runtime. There is no `.env` and nothing to
configure.

## Stack

React, TypeScript, Vite, Tailwind, Zustand for state, MapLibre GL for the 2D and
3D map, and three.js (through react-globe.gl) for the stylized globe. The map and
globe engines are loaded on demand so the first paint stays light. The build also
ships as an installable PWA with offline caching of the app shell and basemap.

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
  services/     one file per feed, each returning normalized events
  hooks/        feed polling and the circuit breaker
  store.ts      app state (events, threat, filters, view mode)
  components/   header, map, globe, panels, overlays
  types.ts      shared types
```

Adding a layer is three steps: write a fetcher in `services/`, register it in
`hooks/useFeeds.ts`, and add it to the source list and category map in
`store.ts`.

## License

MIT. See [LICENSE](LICENSE). Built on public open data, so check each provider's
terms and rate limits before you lean on them hard.
