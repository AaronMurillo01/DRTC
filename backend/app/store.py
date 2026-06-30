"""In-memory snapshot store: the single source of truth the API reads from.

Events are kept per source (a new batch replaces the previous one for that
source, mirroring the frontend's ingest semantics), so a flaky feed never
duplicates or strands stale tracks.
"""

from __future__ import annotations

import time

from .orbital.groundstations import GROUND_STATIONS
from .schemas import (
    ContactWindowModel,
    Event,
    GroundStationModel,
    SatPositionModel,
    Snapshot,
    Source,
    ThreatState,
)


def now_ms() -> int:
    return int(time.time() * 1000)


class Store:
    def __init__(self) -> None:
        self.events_by_source: dict[str, list[Event]] = {}
        self.sources: dict[str, Source] = {}
        self.threat = ThreatState(level=1, label="NOMINAL", index=0, trend="flat")
        self.ground_stations: list[GroundStationModel] = [
            GroundStationModel(
                id=s.id,
                name=s.name,
                operator=s.operator,
                lat=s.lat,
                lng=s.lng,
                bands=list(s.bands),
                min_elev_deg=s.min_elev_deg,
            )
            for s in GROUND_STATIONS
        ]
        self.sat_positions: list[SatPositionModel] = []
        self.passes: list[ContactWindowModel] = []

    def register_source(self, src: Source) -> None:
        self.sources[src.id] = src

    def set_events(self, source_id: str, events: list[Event]) -> None:
        self.events_by_source[source_id] = events

    def all_events(self) -> list[Event]:
        out: list[Event] = []
        for batch in self.events_by_source.values():
            out.extend(batch)
        out.sort(key=lambda e: e.timestamp, reverse=True)
        return out

    def snapshot(self) -> Snapshot:
        return Snapshot(
            events=self.all_events(),
            sources=list(self.sources.values()),
            threat=self.threat,
            ground_stations=self.ground_stations,
            sat_positions=self.sat_positions,
            passes=self.passes,
            server_time=now_ms(),
        )


store = Store()
