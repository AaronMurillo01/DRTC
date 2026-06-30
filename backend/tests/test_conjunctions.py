from datetime import UTC, datetime

from app.orbital.conjunctions import ALERT_KM, screen_conjunctions
from app.orbital.passes import TrackedSat

# Two co-orbital objects: the ISS element set and a "twin" phased a hair ahead in
# mean anomaly. They ride the same ellipse, so a close approach is guaranteed and
# the screen result is deterministic.
ISS = TrackedSat(
    25544,
    "ISS (ZARYA)",
    "1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009",
    "2 25544  51.6423 339.0822 0007423  68.4684 280.0578 15.49514637 18888",
)
TWIN = TrackedSat(
    99999,
    "TWIN",
    "1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009",
    "2 25544  51.6423 339.0822 0007423  68.4684 280.0878 15.49514637 18888",
)
NOW = datetime(2020, 1, 29, 12, 30, 0, tzinfo=UTC).timestamp() * 1000


def test_finds_the_pair():
    cdms = screen_conjunctions([ISS, TWIN], NOW, horizon_hours=2, step_sec=60)
    assert len(cdms) == 1
    c = cdms[0]
    assert {c.a_id, c.b_id} == {25544, 99999}


def test_close_approach_is_physical():
    c = screen_conjunctions([ISS, TWIN], NOW, horizon_hours=2, step_sec=60)[0]
    assert c.miss_km > 0
    assert c.miss_km < 100  # phased twins stay tens of km apart
    assert c.rel_speed_km_s >= 0
    assert NOW <= c.tca <= NOW + 2 * 3600 * 1000
    assert c.alert == (c.miss_km < ALERT_KM)


def test_results_sorted_and_capped():
    cdms = screen_conjunctions([ISS, TWIN, ISS], NOW, horizon_hours=1, step_sec=60, top_k=2)
    assert len(cdms) <= 2
    misses = [c.miss_km for c in cdms]
    assert misses == sorted(misses)


def test_single_object_has_no_pairs():
    assert screen_conjunctions([ISS], NOW, horizon_hours=2) == []
