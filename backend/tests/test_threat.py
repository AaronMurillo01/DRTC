from app.ingest.feeds import _clamp, _iso_ms
from app.schemas import Event
from app.threat import compute_threat


def _ev(**kw) -> Event:
    base = dict(
        id="x",
        source="t",
        category="seismic",
        severity=50,
        title="t",
        summary="s",
        timestamp=0,
    )
    base.update(kw)
    return Event(**base)


def test_threat_nominal_when_empty():
    t = compute_threat([])
    assert t.level == 1
    assert t.index == 0
    assert t.label == "NOMINAL"


def test_threat_escalates_with_severity_and_volume():
    quiet = compute_threat([_ev(severity=30)])
    loud = compute_threat([_ev(severity=95) for _ in range(40)])
    assert loud.index > quiet.index
    assert loud.level >= quiet.level


def test_threat_trend_follows_previous_index():
    up = compute_threat([_ev(severity=90) for _ in range(20)], prev_index=0)
    assert up.trend == "up"


def test_reference_categories_do_not_drive_threat():
    # orbital/spaceport/nuclear are reference layers, not live threat drivers.
    t = compute_threat([_ev(category="orbital", severity=100)])
    assert t.index == 0


def test_clamp_and_iso_helpers():
    assert _clamp(5 * 12, 10, 100) == 60
    assert _clamp(1, 10, 100) == 10
    assert _clamp(999, 10, 100) == 100
    assert _iso_ms("2020-01-29T12:30:00Z") > 0
    assert _iso_ms(None) == 0
    assert _iso_ms("not-a-date") == 0
