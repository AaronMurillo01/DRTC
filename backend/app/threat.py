"""Correlation engine: rolls the live event stream into a single threat picture.

A compact port of the frontend heuristic. It is explicitly a demonstration
score, not an intelligence product: severity and density of recent located
events drive a 0-100 index and a five-level condition.
"""

from __future__ import annotations

from .schemas import Event, ThreatState

_LEVELS = [
    (0, 1, "NOMINAL"),
    (25, 2, "ELEVATED"),
    (45, 3, "GUARDED"),
    (65, 4, "HIGH"),
    (82, 5, "CRITICAL"),
]
_LIVE_CATEGORIES = {"seismic", "disaster", "space", "signals", "weather", "air"}


def compute_threat(events: list[Event], prev_index: int = 0) -> ThreatState:
    live = [e for e in events if e.category in _LIVE_CATEGORIES]
    if not live:
        return ThreatState(level=1, label="NOMINAL", index=0, trend="flat")

    top = sorted((e.severity for e in live), reverse=True)[:12]
    peak = top[0] if top else 0
    avg_top = sum(top) / len(top)
    volume = min(1.0, len(live) / 60.0)

    index = int(round(0.5 * peak + 0.35 * avg_top + 15.0 * volume))
    index = max(0, min(100, index))

    level, label = 1, "NOMINAL"
    for threshold, lvl, lbl in _LEVELS:
        if index >= threshold:
            level, label = lvl, lbl

    trend = "flat"
    if index > prev_index + 2:
        trend = "up"
    elif index < prev_index - 2:
        trend = "down"
    return ThreatState(level=level, label=label, index=index, trend=trend)
