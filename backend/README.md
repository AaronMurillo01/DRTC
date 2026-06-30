# DRTC backend

An async ingestion + real-time fan-out service for DRTC. It polls the public
feeds once for the whole fleet, runs SGP4 pass prediction server-side, and
streams the result to clients over a websocket. See
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the system design.

Stack: FastAPI, httpx, Pydantic v2, sgp4. In-process pub/sub broker with a
Redis-swappable interface. No database required to run.

## Run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Then:

```bash
curl localhost:8000/api/health
curl localhost:8000/api/snapshot
# live stream:
#   websocat ws://localhost:8000/ws
```

Or with Docker, from the repo root:

```bash
docker compose up --build          # backend on :8000
docker compose --profile scale up  # also brings up Redis for the scaling phase
```

## Test + lint

```bash
pytest -q
ruff check app tests
```

## Configuration

All settings are environment variables prefixed `DRTC_` (see `app/config.py`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `DRTC_CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `DRTC_PASS_HORIZON_HOURS` | `12` | Pass-prediction look-ahead |
| `DRTC_PASS_STEP_SEC` | `30` | Coarse propagation step |
| `DRTC_TLE_REFRESH_SEC` | `1800` | How often to refresh TLEs |
| `DRTC_REDIS_URL` | unset | When set, use the Redis broker + shared snapshot cache (multi-replica) |

## Layout

```
app/
  main.py            FastAPI gateway: REST + websocket
  config.py          env-driven settings
  store.py           in-memory snapshot (source of truth)
  broker.py          pub/sub fan-out (in-memory or Redis)
  cache.py           shared snapshot cache (null or Redis)
  runtime.py         resolves broker + cache at startup
  threat.py          correlation / threat index
  ingest/
    feeds.py         async fetch + normalize per upstream
    scheduler.py     per-feed tasks, circuit breakers, ground-link worker
  orbital/
    geo.py           TEME -> ECEF -> topocentric look angles
    passes.py        SGP4 pass prediction
    groundstations.py ground-station network
tests/               pytest suite (pass engine + threat)
```
