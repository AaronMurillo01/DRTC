"""Prometheus metrics.

Counters and histograms are incremented by the ingest workers as work happens;
the point-in-time gauges are set in the /metrics handler at scrape time from the
current store, which keeps them accurate without scattering set() calls.
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

# --- ingest counters / latency (updated in the workers) -------------------
FEED_SYNCS = Counter("drtc_feed_syncs_total", "Successful feed syncs", ["feed"])
FEED_FAILURES = Counter("drtc_feed_failures_total", "Feed failures", ["feed"])
FEED_LATENCY = Histogram("drtc_feed_latency_seconds", "Feed fetch latency", ["feed"])
GROUNDLINK_COMPUTE = Histogram(
    "drtc_groundlink_compute_seconds", "SGP4 + screening + planning compute time"
)

# --- point-in-time gauges (set at scrape time) ----------------------------
EVENTS = Gauge("drtc_events", "Current event count")
SOURCES_ONLINE = Gauge("drtc_sources_online", "Feeds online or degraded")
WS_SUBSCRIBERS = Gauge("drtc_ws_subscribers", "Active websocket subscribers")
PASSES = Gauge("drtc_passes", "Predicted contact windows")
CONJUNCTION_ALERTS = Gauge("drtc_conjunction_alerts", "Conjunctions inside the alert threshold")
THREAT_INDEX = Gauge("drtc_threat_index", "Global threat index (0-100)")
