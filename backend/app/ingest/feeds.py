"""Async feed fetchers + normalizers. Each returns a list of Event models.

Every upstream here is public, key-less and CORS-friendly. Parsing is kept
defensive: a shape change upstream should drop records, not crash the worker.
"""

from __future__ import annotations

import hashlib
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx

from ..orbital.passes import TrackedSat
from ..schemas import Event


def _clamp(n: float, lo: float, hi: float) -> int:
    return int(max(lo, min(hi, n)))


def _hash_id(prefix: str, *parts: object) -> str:
    h = hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:8]
    return f"{prefix}-{h}"


@dataclass(frozen=True)
class FeedSpec:
    id: str
    label: str
    category: str
    interval_sec: int
    fetch: Callable[[httpx.AsyncClient], Awaitable[list[Event]]]


# --- USGS seismic ---------------------------------------------------------
async def fetch_seismic(client: httpx.AsyncClient) -> list[Event]:
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    r = await client.get(url)
    r.raise_for_status()
    out: list[Event] = []
    for f in r.json().get("features", []):
        props = f.get("properties", {})
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None, None]
        mag = props.get("mag")
        if mag is None or coords[0] is None:
            continue
        out.append(
            Event(
                id=f.get("id") or _hash_id("eq", props.get("time"), coords[0], coords[1]),
                source="USGS",
                category="seismic",
                severity=_clamp(mag * 12, 10, 100),
                title=props.get("place") or f"M{mag} earthquake",
                summary=f"M{mag} · depth {coords[2]} km",
                timestamp=int(props.get("time") or 0),
                lat=coords[1],
                lng=coords[0],
                url=props.get("url"),
            )
        )
    return out


# --- ISS live position ----------------------------------------------------
async def fetch_orbital(client: httpx.AsyncClient) -> list[Event]:
    r = await client.get("https://api.wheretheiss.at/v1/satellites/25544")
    r.raise_for_status()
    d = r.json()
    return [
        Event(
            id="iss-25544",
            source="ISS / NORAD 25544",
            category="orbital",
            severity=20,
            title="ISS - International Space Station",
            summary=f"Alt {round(d['altitude'])} km · {round(d['velocity'])} km/h",
            timestamp=int(d["timestamp"]) * 1000,
            lat=d["latitude"],
            lng=d["longitude"],
        )
    ]


# --- NOAA SWPC planetary K-index -----------------------------------------
async def fetch_space(client: httpx.AsyncClient) -> list[Event]:
    url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
    r = await client.get(url)
    r.raise_for_status()
    rows = r.json()
    if len(rows) < 2:
        return []
    header, *data = rows
    last = data[-1]
    rec = dict(zip(header, last, strict=False))
    try:
        kp = float(rec.get("Kp", rec.get("kp", 0)))
    except (TypeError, ValueError):
        kp = 0.0
    return [
        Event(
            id=_hash_id("kp", rec.get("time_tag")),
            source="NOAA SWPC",
            category="space",
            severity=_clamp(kp * 11, 5, 100),
            title=f"Planetary K-index Kp={kp:g}",
            summary="Geomagnetic activity" + (" · storm levels" if kp >= 5 else ""),
            timestamp=int(time.time() * 1000),
        )
    ]


# --- NASA EONET natural disasters ----------------------------------------
async def fetch_disasters(client: httpx.AsyncClient) -> list[Event]:
    url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50"
    r = await client.get(url)
    r.raise_for_status()
    out: list[Event] = []
    for e in r.json().get("events", []):
        geoms = e.get("geometry") or []
        if not geoms:
            continue
        last = geoms[-1]
        coords = last.get("coordinates")
        if not coords or not isinstance(coords[0], (int, float)):
            continue
        cats = e.get("categories") or [{}]
        out.append(
            Event(
                id=e.get("id") or _hash_id("eonet", e.get("title")),
                source="NASA EONET",
                category="disaster",
                severity=60,
                title=e.get("title") or "Natural event",
                summary=(cats[0].get("title") or "event"),
                timestamp=_iso_ms(last.get("date")),
                lat=coords[1],
                lng=coords[0],
                url=(e.get("sources") or [{}])[0].get("url"),
            )
        )
    return out


def _iso_ms(s: str | None) -> int:
    if not s:
        return 0
    from datetime import datetime

    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return 0


# --- TLE fetch for the tracked constellation ------------------------------
TRACKED = [
    (25544, "ISS (ZARYA)"),
    (20580, "HUBBLE (HST)"),
    (49260, "LANDSAT 9"),
    (43013, "NOAA 20 (JPSS-1)"),
    (40697, "SENTINEL-2A"),
    (27424, "AQUA"),
]


async def fetch_tles(client: httpx.AsyncClient) -> list[TrackedSat]:
    base = "https://tle.ivanstanojevic.me/api/tle"
    sats: list[TrackedSat] = []
    for sid, name in TRACKED:
        try:
            r = await client.get(f"{base}/{sid}", timeout=9.0)
            r.raise_for_status()
            d = r.json()
            l1, l2 = d.get("line1", ""), d.get("line2", "")
            if l1.startswith("1 ") and l2.startswith("2 "):
                sats.append(TrackedSat(sid, name, l1, l2))
        except (httpx.HTTPError, ValueError, KeyError):
            continue
    if not sats:
        raise RuntimeError("no TLEs available")
    return sats


FEEDS: list[FeedSpec] = [
    FeedSpec("orbital", "ISS Telemetry", "orbital", 5, fetch_orbital),
    FeedSpec("seismic", "USGS Seismic", "seismic", 60, fetch_seismic),
    FeedSpec("space", "NOAA Space Wx", "space", 120, fetch_space),
    FeedSpec("disaster", "NASA EONET", "disaster", 300, fetch_disasters),
]
