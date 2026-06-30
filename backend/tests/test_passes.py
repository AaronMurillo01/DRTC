from datetime import UTC, datetime

from app.orbital.groundstations import GROUND_STATIONS
from app.orbital.passes import (
    TrackedSat,
    active_contacts,
    compute_passes,
    sky_track,
    subpoint,
)

# Canonical, well-formed ISS TLE (the example set shipped with satellite.js / sgp4).
ISS = TrackedSat(
    25544,
    "ISS (ZARYA)",
    "1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009",
    "2 25544  51.6423 339.0822 0007423  68.4684 280.0578 15.49514637 18888",
)
NOW = datetime(2020, 1, 29, 12, 30, 0, tzinfo=UTC).timestamp() * 1000


def test_subpoint_is_in_leo():
    p = subpoint(ISS, NOW)
    assert p is not None
    assert -90 <= p.lat <= 90
    assert 300 < p.alt_km < 500
    assert 7.0 < p.velocity_km_s < 8.5


def test_subpoint_rejects_garbage():
    assert subpoint(TrackedSat(0, "x", "garbage", "garbage"), NOW) is None


def test_passes_are_physical_and_sorted():
    passes, positions = compute_passes(
        [ISS], GROUND_STATIONS, NOW, horizon_hours=24, step_sec=60
    )
    assert len(positions) == 1
    assert len(passes) > 0
    by_id = {s.id: s for s in GROUND_STATIONS}
    for p in passes:
        st = by_id[p.station_id]
        assert p.los > p.aos
        assert p.duration_sec > 0
        assert st.min_elev_deg <= p.max_elevation_deg <= 90
        assert 0 <= p.start_az <= 360
        assert p.downlink_mbps > 0
        assert p.volume_mb > 0
        assert p.doppler_khz >= 0
    aos_times = [p.aos for p in passes]
    assert aos_times == sorted(aos_times)


def test_active_contacts_spans_instant():
    passes, _ = compute_passes([ISS], GROUND_STATIONS, NOW, horizon_hours=24, step_sec=60)
    p = passes[0]
    mid = (p.aos + p.los) / 2
    live = active_contacts(passes, mid)
    assert p in live
    assert all(c.aos <= mid <= c.los for c in live)


def test_sky_track_within_bounds():
    passes, _ = compute_passes([ISS], GROUND_STATIONS, NOW, horizon_hours=24, step_sec=60)
    p = passes[0]
    st = next(s for s in GROUND_STATIONS if s.id == p.station_id)
    track = sky_track(ISS, st, p.aos, p.los, 24)
    assert len(track) > 2
    for az, el in track:
        assert 0 <= el <= 90
        assert 0 <= az <= 360
