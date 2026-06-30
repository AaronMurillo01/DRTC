from app.history import NullHistory, SqliteHistory, make_history


def _ev(eid: str, sev: int):
    return {"id": eid, "lat": 1.0, "lng": 2.0, "severity": sev, "category": "seismic", "title": eid}


def test_null_history_is_empty():
    h = NullHistory()
    h.record(1, 0, 1, [_ev("a", 50)])
    assert h.frames() == []
    assert h.frame_events(1) == []


def test_records_and_lists_frames_in_time_order():
    h = SqliteHistory(":memory:")
    h.record(1000, 10, 2, [_ev("a", 50)])
    h.record(2000, 40, 3, [_ev("a", 50), _ev("b", 80)])
    frames = h.frames()
    assert [f.ts for f in frames] == [1000, 2000]
    assert frames[-1].threat_index == 40
    assert frames[-1].event_count == 2
    h.close()


def test_frame_events_returns_state_as_of_time():
    h = SqliteHistory(":memory:")
    h.record(1000, 10, 2, [_ev("a", 50)])
    h.record(2000, 40, 3, [_ev("a", 50), _ev("b", 80)])
    # At t=1500 the most recent frame is the one at 1000.
    at_1500 = h.frame_events(1500)
    assert {e["id"] for e in at_1500} == {"a"}
    # At t=2500 it is the frame at 2000.
    at_2500 = h.frame_events(2500)
    assert {e["id"] for e in at_2500} == {"a", "b"}
    # Before the first frame, fall back to the earliest.
    assert {e["id"] for e in h.frame_events(0)} == {"a"}
    h.close()


def test_since_filter_and_retention():
    h = SqliteHistory(":memory:", retention_hours=1.0)
    base = 10_000_000
    h.record(base, 5, 1, [])
    # A frame more than an hour after base prunes the old one on insert.
    h.record(base + 2 * 3600_000, 9, 1, [])
    ts = [f.ts for f in h.frames()]
    assert base not in ts
    assert base + 2 * 3600_000 in ts
    h.close()


def test_make_history_defaults_to_sqlite():
    assert isinstance(make_history(None), SqliteHistory)
