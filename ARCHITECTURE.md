# DRTC architecture

DRTC started as a single-page app where every browser independently polled a
dozen public APIs and ran its own orbit propagation. That works, but it does not
match the name: nothing is actually distributed. The backend in `backend/` is the
next step. It turns DRTC into a small real-time system with a clean split between
the write path (ingestion) and the read path (the gateway clients talk to).

## High level

```
            +-------------------+
 public     |  ingest workers   |   one async task per feed, own cadence,
 data  ---> |  (httpx pollers)  |   per-source circuit breaker
 APIs       +---------+---------+
                      | normalize (Pydantic)
                      v
            +-------------------+        +-------------------+
            |   in-memory store |        |  SGP4 pass engine |  runs in a
            |  (snapshot truth) | <----- |  (thread offload) |  worker thread
            +---------+---------+        +-------------------+
                      | publish deltas
                      v
            +-------------------+
            |      broker       |   in-process pub/sub today,
            |   (pub/sub fan-out)|   Redis-swappable interface
            +---------+---------+
                      |
        +-------------+-------------+
        v                           v
+----------------+         +------------------+
| FastAPI REST   |         |  WebSocket /ws   |   snapshot on connect,
| /api/*         |         |  (delta stream)  |   then live deltas
+--------+-------+         +---------+--------+
         |                           |
         +------------+--------------+
                      v
                React frontend (many clients)
```

## Why this shape

- **Write/read separation.** Ingest workers never touch a client connection; the
  gateway never fetches an upstream. They share only the store and the broker, so
  the gateway is stateless and can be replicated behind a load balancer.
- **Fan-in, fan-out.** Twelve upstreams are polled once for the whole fleet
  instead of once per browser. One SGP4 run feeds every client.
- **Backpressure.** The broker drops the oldest frame for a slow websocket rather
  than blocking ingest, so one stalled client can't wedge the pipeline.
- **Failure isolation.** Each feed has its own task and circuit breaker; a dead
  endpoint backs off exponentially without affecting the others.
- **CPU offload.** Pass prediction over the full station network is CPU bound, so
  it runs in a thread (`asyncio.to_thread`) and never blocks the event loop.
- **Pluggable backend.** The broker and snapshot cache sit behind interfaces,
  resolved once at startup (`app/runtime.py`). With no config they are in-process;
  with `DRTC_REDIS_URL` set they become Redis-backed, so ingest in one process
  fans out to websocket clients held by other gateway replicas, and a replica that
  does not run ingest still serves the current snapshot from the shared cache.

## Components

| Module | Responsibility |
| --- | --- |
| `app/ingest/feeds.py` | Async fetch + normalize for each upstream into the `Event` model |
| `app/ingest/scheduler.py` | One task per feed + the ground-link worker; circuit breakers; publishes deltas |
| `app/orbital/passes.py` | SGP4 pass prediction (AOS/LOS, peak elevation, Doppler, link budget) |
| `app/orbital/conjunctions.py` | Pairwise close-approach screening (TCA, miss distance, relative speed) |
| `app/orbital/planning.py` | Contact scheduling (OR-Tools CP-SAT no-overlap contention model) |
| `app/orbital/geo.py` | TEME to ECEF to topocentric look angles (the astrodynamics) |
| `app/store.py` | In-memory snapshot, the single source of truth |
| `app/broker.py` | Pub/sub fan-out: in-memory or Redis implementation |
| `app/cache.py` | Shared snapshot cache (null or Redis) for multi-replica reads |
| `app/runtime.py` | Resolves broker + cache at startup from config |
| `app/main.py` | FastAPI gateway: REST endpoints + websocket |
| `app/threat.py` | Correlation engine (heuristic threat index) |

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness + source/subscriber counts |
| `GET /api/snapshot` | Full current state (what a new client gets) |
| `GET /api/events` | Filter by `category`, `min_severity` |
| `GET /api/sources` | Feed health (status, latency, failures) |
| `GET /api/threat` | Current threat state |
| `GET /api/passes` | Contact windows, filter by `station_id` or `sat_id` |
| `GET /api/conjunctions` | Closest approaches between tracked objects (`alerts_only`) |
| `GET /api/ground-stations` | The ground-station network |
| `POST /api/skytrack` | Server-side az/el track for a pass |
| `WS /ws` | Snapshot on connect, then live deltas |

## Frontend integration

The React app consumes the gateway when `VITE_DRTC_API` is set at build time. It
opens `/ws`, applies the snapshot, then applies deltas (`events`, `sources`,
`passes`, `threat`), and re-derives the analytic layers (country risk, threat,
SITREP) from the streamed events. The client pollers stay off in this mode, and a
capped-backoff reconnect keeps the link alive. With no URL set the app runs its
own pollers and orbital engines, so the static deploy is unaffected.

## Scaling path (next phases)

1. Persist events to **TimescaleDB / PostGIS** for history, replay, and geo
   queries. (The Redis broker + snapshot cache, conjunction screening, and the
   CP-SAT contact scheduler are already in place.)
2. Add **Prometheus metrics + Grafana** on the backend.
