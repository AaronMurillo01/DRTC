"""Pydantic models for the API surface.

Field names serialize to camelCase so the payloads are drop-in compatible with
the existing TypeScript frontend types.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Event(_Base):
    id: str
    source: str
    category: str
    severity: int
    title: str
    summary: str
    timestamp: int
    lat: float | None = None
    lng: float | None = None
    url: str | None = None
    region: str | None = None


class Source(_Base):
    id: str
    label: str
    category: str
    status: str
    last_sync: int | None = None
    count: int = 0
    latency_ms: int | None = None
    consecutive_failures: int = 0
    syncs: int = 0
    error: str | None = None


class ThreatState(_Base):
    level: int
    label: str
    index: int
    trend: str


class GroundStationModel(_Base):
    id: str
    name: str
    operator: str
    lat: float
    lng: float
    bands: list[str]
    min_elev_deg: float


class SatPositionModel(_Base):
    id: int
    name: str
    lat: float
    lng: float
    alt_km: float
    velocity_km_s: float


class ContactWindowModel(_Base):
    id: str
    sat_id: int
    sat_name: str
    station_id: str
    station_name: str
    operator: str
    aos: float
    los: float
    duration_sec: float
    max_elevation_deg: float
    start_az: float
    end_az: float
    band: str
    downlink_mbps: float
    volume_mb: float
    doppler_khz: float


class ConjunctionModel(_Base):
    id: str
    a_id: int
    a_name: str
    b_id: int
    b_name: str
    tca: float
    miss_km: float
    rel_speed_km_s: float
    alert: bool


class PlanModel(_Base):
    scheduled_ids: list[str]
    requested: int
    scheduled_count: int
    dropped_count: int
    total_volume_mb: float
    status: str


class Snapshot(_Base):
    """Full state sent to a client on connect."""

    events: list[Event]
    sources: list[Source]
    threat: ThreatState
    ground_stations: list[GroundStationModel]
    sat_positions: list[SatPositionModel]
    passes: list[ContactWindowModel]
    conjunctions: list[ConjunctionModel]
    plan: PlanModel | None
    server_time: int


class WSMessage(_Base):
    """Incremental update pushed over the websocket."""

    type: str  # "events" | "threat" | "passes" | "sources"
    payload: dict
