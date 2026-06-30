"""DRTC backend gateway: REST snapshot/query endpoints + websocket fan-out.

Read path (this file) is fully decoupled from the write path (ingest workers):
they communicate only through the in-memory store and the broker, so the gateway
stays stateless and could be scaled horizontally behind a shared Redis.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .ingest.scheduler import scheduler
from .orbital.passes import TrackedSat, sky_track
from .runtime import runtime
from .store import now_ms, store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("drtc")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await runtime.startup()
    await scheduler.start()
    try:
        yield
    finally:
        await scheduler.stop()
        await runtime.shutdown()


app = FastAPI(title="DRTC Backend", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    live = [s for s in store.sources.values() if s.status in ("online", "degraded")]
    return {
        "status": "ok",
        "serverTime": now_ms(),
        "sourcesOnline": len(live),
        "sourcesTotal": len(store.sources),
        "subscribers": runtime.broker.subscriber_count,
        "passes": len(store.passes),
    }


@app.get("/api/snapshot")
async def snapshot() -> dict:
    return store.snapshot().model_dump(by_alias=True)


@app.get("/api/events")
async def events(category: str | None = None, min_severity: int = 0) -> dict:
    items = store.all_events()
    if category:
        items = [e for e in items if e.category == category]
    if min_severity:
        items = [e for e in items if e.severity >= min_severity]
    return {"events": [e.model_dump(by_alias=True) for e in items]}


@app.get("/api/sources")
async def sources() -> dict:
    return {"sources": [s.model_dump(by_alias=True) for s in store.sources.values()]}


@app.get("/api/threat")
async def threat() -> dict:
    return store.threat.model_dump(by_alias=True)


@app.get("/api/passes")
async def passes(station_id: str | None = None, sat_id: int | None = None) -> dict:
    items = store.passes
    if station_id:
        items = [p for p in items if p.station_id == station_id]
    if sat_id is not None:
        items = [p for p in items if p.sat_id == sat_id]
    return {
        "passes": [p.model_dump(by_alias=True) for p in items],
        "satPositions": [p.model_dump(by_alias=True) for p in store.sat_positions],
    }


@app.get("/api/ground-stations")
async def ground_stations() -> dict:
    return {"groundStations": [g.model_dump(by_alias=True) for g in store.ground_stations]}


@app.get("/api/conjunctions")
async def conjunctions(alerts_only: bool = False) -> dict:
    items = store.conjunctions
    if alerts_only:
        items = [c for c in items if c.alert]
    return {"conjunctions": [c.model_dump(by_alias=True) for c in items]}


@app.get("/api/plan")
async def plan() -> dict:
    return {"plan": store.plan.model_dump(by_alias=True) if store.plan else None}


@app.get("/api/passes/{pass_id}/skytrack")
async def pass_skytrack(pass_id: str) -> dict:
    p = next((x for x in store.passes if x.id == pass_id), None)
    if p is None:
        return {"error": "pass not found", "track": []}
    st = next((s for s in store.ground_stations if s.id == p.station_id), None)
    sat_pos = next((s for s in store.sat_positions if s.id == p.sat_id), None)
    if st is None or sat_pos is None:
        return {"error": "missing station or satellite", "track": []}
    # Rebuild a TrackedSat from the live snapshot is not available here; the
    # skytrack is recomputed by the frontend from the TLE it already holds. We
    # expose the station + window so a thin client can request it if needed.
    return {
        "passId": pass_id,
        "station": st.model_dump(by_alias=True),
        "aos": p.aos,
        "los": p.los,
        "track": [],
    }


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    # Send the full snapshot first, then stream deltas. Prefer the shared cache
    # (so a replica not running ingest is still correct), else the local store.
    snap = await runtime.cache.read() or store.snapshot().model_dump(by_alias=True)
    await websocket.send_json({"type": "snapshot", "payload": snap})
    async with runtime.broker.subscribe() as queue:
        try:
            while True:
                msg = await queue.get()
                await websocket.send_json(msg)
        except WebSocketDisconnect:
            pass
        except (asyncio.CancelledError, RuntimeError):
            with contextlib.suppress(Exception):
                await websocket.close()


# Convenience: pass-track computed server-side from a TLE supplied by the client.
@app.post("/api/skytrack")
async def skytrack(body: dict) -> dict:
    try:
        sat = TrackedSat(
            id=int(body.get("id", 0)),
            name=str(body.get("name", "")),
            line1=str(body["line1"]),
            line2=str(body["line2"]),
        )
        from .orbital.groundstations import GROUND_STATIONS

        st = next(s for s in GROUND_STATIONS if s.id == body["stationId"])
        track = sky_track(sat, st, float(body["aos"]), float(body["los"]), int(body.get("n", 40)))
        return {"track": [{"az": a, "el": e} for a, e in track]}
    except (KeyError, StopIteration, ValueError, TypeError) as exc:
        return {"error": str(exc), "track": []}
