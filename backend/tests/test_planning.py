from app.orbital.passes import ContactWindow
from app.orbital.planning import plan_contacts

T0 = 1_700_000_000_000


def cw(pid: str, sat_id: int, station_id: str, start_min: float, dur_min: float, vol: float):
    aos = T0 + start_min * 60_000
    los = aos + dur_min * 60_000
    return ContactWindow(
        id=pid,
        sat_id=sat_id,
        sat_name=f"SAT{sat_id}",
        station_id=station_id,
        station_name=station_id,
        operator="OP",
        aos=aos,
        los=los,
        duration_sec=dur_min * 60,
        max_elevation_deg=30,
        start_az=10,
        end_az=200,
        band="X",
        downlink_mbps=150,
        volume_mb=vol,
        doppler_khz=180,
    )


def test_empty_plan():
    r = plan_contacts([])
    assert r.status == "EMPTY"
    assert r.scheduled_count == 0


def test_non_conflicting_passes_all_scheduled():
    passes = [
        cw("a", 1, "st1", 0, 10, 100),
        cw("b", 2, "st2", 0, 10, 100),
        cw("c", 1, "st1", 20, 10, 100),
    ]
    r = plan_contacts(passes)
    assert r.scheduled_count == 3
    assert r.dropped_count == 0


def test_same_station_overlap_drops_lower_value():
    # Two passes overlap at the same station; the scheduler keeps the richer one.
    passes = [
        cw("low", 1, "st1", 0, 10, 50),
        cw("high", 2, "st1", 5, 10, 500),
    ]
    r = plan_contacts(passes)
    assert r.scheduled_count == 1
    assert "high" in r.scheduled_ids
    assert "low" not in r.scheduled_ids


def test_same_satellite_cannot_be_in_two_contacts():
    # One satellite, two stations, overlapping windows: only one can be kept.
    passes = [
        cw("s1", 7, "st1", 0, 10, 100),
        cw("s2", 7, "st2", 3, 10, 100),
    ]
    r = plan_contacts(passes)
    assert r.scheduled_count == 1


def test_total_volume_matches_scheduled():
    passes = [
        cw("a", 1, "st1", 0, 10, 120),
        cw("b", 2, "st2", 0, 10, 80),
    ]
    r = plan_contacts(passes)
    assert r.scheduled_count == 2
    assert abs(r.total_volume_mb - 200) < 1e-6
    assert r.status in ("OPTIMAL", "FEASIBLE")
