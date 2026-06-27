# DRTC — Distributed Real-Time Command & Control System

> A tactical, browser-based situational-awareness console that fuses live open
> data — seismic, natural-disaster, space-weather, orbital, geopolitical, and
> market feeds — into a single 3D command picture, a Global Threat Index, and a
> per-country Instability Index. **No API keys. No backend. Runs anywhere.**

DRTC is inspired by [worldmonitor](https://github.com/koala73/worldmonitor) and
rebuilt from scratch as a leaner, key-free, self-contained dashboard with a
command-and-control aesthetic and a correlation engine on top of the raw feeds.

![DRTC](docs/preview.png)

---

## Features

- **Tactical 3D globe** (`react-globe.gl` / Three.js) plotting every located
  event in real time — point size & altitude scale with severity, high-severity
  tracks emit animated pulse rings, click any track to fly the camera to it.
- **Live Intel Stream** — a unified, severity-ranked feed of all events with
  source tags, severity bars, and age, normalized from six independent sources.
- **Global Threat Index + 5-tier Condition** (`NOMINAL → CRITICAL`) — a
  correlation engine scores the whole event stream and shows a live gauge with
  rising/falling trend.
- **DRTC Instability Index (CII)** — a proximity-weighted stress score for 20
  Tier-1 nations, combining a geopolitical baseline with nearby live events and
  surfacing the top drivers per country.
- **Markets Radar** — live crypto majors with 24h moves.
- **Layer control & filters** — toggle any data layer from the globe legend or
  the command palette.
- **⌘K Command Palette** — keyboard-driven control of layers, focus, and feeds.
- **Feed Integrity panel** — per-source health, latency, and last-sync, with
  graceful degraded/offline states.
- **Pause/Resume**, live UTC clock, and a scrolling priority-event ticker.

## Improvements over the original

| Area | worldmonitor | DRTC |
| --- | --- | --- |
| Setup | Many providers need keys / Ollama / edge functions | **Zero keys, zero backend** — static SPA |
| Data model | Per-feed | **Unified `IntelEvent`** normalization across all sources |
| Scoring | Country Instability Index | **Global Threat Index + Condition tiers + proximity-weighted CII correlation engine** |
| UI | Intelligence dashboard | **Command-&-control console** (threat conditions, feed integrity, ⌘K palette) |
| Footprint | Large monorepo (Tauri, proto, edge) | **Single Vite + React app**, deploys to any static host |

## Live data sources (all free, key-less, CORS-enabled)

| Layer | Source | Endpoint |
| --- | --- | --- |
| Seismic | USGS Earthquakes | `earthquake.usgs.gov` GeoJSON |
| Disaster | NASA EONET | `eonet.gsfc.nasa.gov` |
| Space Weather | NOAA SWPC | `services.swpc.noaa.gov` |
| Orbital | ISS (wheretheiss.at) | `api.wheretheiss.at` |
| Signals | GDELT GEO 2.0 | `api.gdeltproject.org` |
| Markets | CoinGecko | `api.coingecko.com` |

Each feed has its own refresh cadence (ISS every 5s, markets/seismic every 60s,
disasters every 5 min, etc.) and degrades independently if a source is down.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · react-globe.gl (Three.js) · lucide-react

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # type-check + production bundle to dist/
npm run preview  # serve the production build
```

> Note: the dashboard fetches all data directly from public APIs in the browser,
> so it needs internet access at runtime. No `.env` or keys are required.

## Architecture

```
src/
  services/        # one module per feed, each → normalized IntelEvent[]
    http.ts        #   fetch helper (timeout + latency)
    seismic.ts disasters.ts space.ts orbital.ts signals.ts markets.ts
    threat.ts      #   correlation engine: Threat Index + Country Instability
  hooks/useFeeds.ts# per-source polling/orchestration
  store.ts         # Zustand store (events, sources, threat, filters)
  components/       # Header, GlobeView, IntelFeed, ThreatPanel,
                   # InstabilityPanel, MarketTicker, SourceStatus,
                   # StatusBar, EventDetail, CommandPalette
  types.ts utils.ts App.tsx main.tsx
```

**Data flow:** `services/*` fetch & normalize → `useFeeds` ingests into the
Zustand `store` on each source's cadence → `threat.ts` recomputes the Global
Threat Index and per-country Instability scores → components render reactively.

### Extending DRTC

Add a new layer in three steps:

1. Create `src/services/<name>.ts` returning `{ events: IntelEvent[], latencyMs }`.
2. Register it in `src/hooks/useFeeds.ts` (`FEEDS` array) with a cadence.
3. Add it to `INITIAL_SOURCES` and `CATEGORY_META` in `src/store.ts`.

## Roadmap

- Cyber & aviation (OpenSky ADS-B) layers
- Arc/connection overlays for cross-event correlations
- Local LLM brief synthesis (Ollama/WebLLM) of the current picture
- PWA offline shell + desktop packaging
- Persisted layouts and saved watch lists

## License

MIT — see [LICENSE](LICENSE). Built on public open-data APIs; respect each
provider's terms and rate limits.
