"""Ingestion scheduler: one async task per feed, plus the ground-link worker.

Each task polls on its own cadence, updates the store, and publishes the delta
to the broker for websocket fan-out. A per-source circuit breaker backs a
failing feed off exponentially (up to 10 minutes) instead of hammering a dead
endpoint, exactly like the frontend did, but now once for the whole fleet.
"""

from __future__ import annotations

import asyncio
import logging
import time

import httpx

from ..broker import broker
from ..config import settings
from ..orbital.conjunctions import screen_conjunctions
from ..orbital.groundstations import GROUND_STATIONS
from ..orbital.passes import compute_passes
from ..schemas import (
    ConjunctionModel,
    ContactWindowModel,
    SatPositionModel,
    Source,
)
from ..store import now_ms, store
from ..threat import compute_threat
from .feeds import FEEDS, FeedSpec, fetch_tles

log = logging.getLogger("drtc.ingest")
_MAX_BACKOFF = 600.0


def _init_sources() -> None:
    for spec in FEEDS:
        store.register_source(
            Source(id=spec.id, label=spec.label, category=spec.category, status="pending")
        )
    store.register_source(
        Source(id="groundlink", label="Ground Link (SGP4)", category="orbital", status="pending")
    )


async def _publish_threat() -> None:
    prev = store.threat.index
    store.threat = compute_threat(store.all_events(), prev)
    await broker.publish({"type": "threat", "payload": store.threat.model_dump(by_alias=True)})


async def _run_feed(spec: FeedSpec, client: httpx.AsyncClient) -> None:
    failures = 0
    while True:
        started = time.perf_counter()
        try:
            events = await spec.fetch(client)
            latency = int((time.perf_counter() - started) * 1000)
            store.set_events(spec.id, events)
            src = store.sources[spec.id]
            store.register_source(
                src.model_copy(
                    update={
                        "status": "degraded" if latency > 6000 else "online",
                        "last_sync": now_ms(),
                        "latency_ms": latency,
                        "count": len(events),
                        "consecutive_failures": 0,
                        "syncs": src.syncs + 1,
                        "error": None,
                    }
                )
            )
            # Send the full merged set so the client can replace wholesale.
            all_events = [e.model_dump(by_alias=True) for e in store.all_events()]
            await broker.publish({"type": "events", "payload": {"events": all_events}})
            await _publish_threat()
            await broker.publish(
                {"type": "sources", "payload": _sources_payload()}
            )
            failures = 0
            await asyncio.sleep(spec.interval_sec)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - feed isolation
            failures += 1
            src = store.sources[spec.id]
            store.register_source(
                src.model_copy(
                    update={
                        "status": "offline",
                        "consecutive_failures": failures,
                        "error": str(exc)[:120],
                    }
                )
            )
            await broker.publish({"type": "sources", "payload": _sources_payload()})
            backoff = min(_MAX_BACKOFF, spec.interval_sec * (2 ** min(failures, 6)))
            log.warning("feed %s failed (%s); backing off %.0fs", spec.id, exc, backoff)
            await asyncio.sleep(backoff)


async def _run_groundlink(client: httpx.AsyncClient) -> None:
    sats: list = []
    tle_at = 0.0
    failures = 0
    while True:
        started = time.perf_counter()
        try:
            stale = (not sats) or (time.time() - tle_at > settings.tle_refresh_sec)
            if stale:
                sats = await fetch_tles(client)
                tle_at = time.time()
            # SGP4 over the whole network is CPU-bound: keep it off the loop.
            passes, positions = await asyncio.to_thread(
                compute_passes,
                sats,
                GROUND_STATIONS,
                now_ms(),
                settings.pass_horizon_hours,
                settings.pass_step_sec,
            )
            store.passes = [ContactWindowModel(**p.__dict__) for p in passes]
            store.sat_positions = [SatPositionModel(**p.__dict__) for p in positions]
            # Screen the same constellation for close approaches (also CPU-bound).
            cdms = await asyncio.to_thread(screen_conjunctions, sats, now_ms())
            store.conjunctions = [ConjunctionModel(**c.__dict__) for c in cdms]
            latency = int((time.perf_counter() - started) * 1000)
            src = store.sources["groundlink"]
            store.register_source(
                src.model_copy(
                    update={
                        "status": "online",
                        "last_sync": now_ms(),
                        "latency_ms": latency,
                        "count": len(passes),
                        "consecutive_failures": 0,
                        "syncs": src.syncs + 1,
                        "error": None,
                    }
                )
            )
            await broker.publish(
                {
                    "type": "passes",
                    "payload": {
                        "passes": [p.model_dump(by_alias=True) for p in store.passes],
                        "satPositions": [p.model_dump(by_alias=True) for p in store.sat_positions],
                        "conjunctions": [c.model_dump(by_alias=True) for c in store.conjunctions],
                    },
                }
            )
            await broker.publish({"type": "sources", "payload": _sources_payload()})
            failures = 0
            await asyncio.sleep(settings.groundlink_interval)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            failures += 1
            src = store.sources["groundlink"]
            store.register_source(
                src.model_copy(
                    update={
                        "status": "offline",
                        "consecutive_failures": failures,
                        "error": str(exc)[:120],
                    }
                )
            )
            backoff = min(_MAX_BACKOFF, settings.groundlink_interval * (2 ** min(failures, 6)))
            log.warning("groundlink failed (%s); backing off %.0fs", exc, backoff)
            await asyncio.sleep(backoff)


def _sources_payload() -> dict:
    return {"sources": [s.model_dump(by_alias=True) for s in store.sources.values()]}


class Scheduler:
    def __init__(self) -> None:
        self._tasks: list[asyncio.Task] = []
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        _init_sources()
        self._client = httpx.AsyncClient(
            timeout=12.0, headers={"User-Agent": "DRTC-backend/0.1"}
        )
        for spec in FEEDS:
            self._tasks.append(asyncio.create_task(_run_feed(spec, self._client)))
        self._tasks.append(asyncio.create_task(_run_groundlink(self._client)))
        log.info("scheduler started with %d feeds", len(FEEDS) + 1)

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        if self._client is not None:
            await self._client.aclose()


scheduler = Scheduler()
