from prometheus_client import generate_latest

from app import metrics


def test_metric_names_are_registered():
    metrics.FEED_SYNCS.labels(feed="seismic").inc()
    metrics.FEED_FAILURES.labels(feed="seismic").inc()
    metrics.FEED_LATENCY.labels(feed="seismic").observe(0.12)
    metrics.GROUNDLINK_COMPUTE.observe(0.4)
    metrics.EVENTS.set(7)
    metrics.THREAT_INDEX.set(42)
    metrics.WS_SUBSCRIBERS.set(3)

    out = generate_latest().decode()
    for name in (
        "drtc_feed_syncs_total",
        "drtc_feed_failures_total",
        "drtc_feed_latency_seconds",
        "drtc_groundlink_compute_seconds",
        "drtc_events",
        "drtc_threat_index",
        "drtc_ws_subscribers",
    ):
        assert name in out


def test_counter_value_increments():
    before = metrics.FEED_SYNCS.labels(feed="space")._value.get()
    metrics.FEED_SYNCS.labels(feed="space").inc()
    after = metrics.FEED_SYNCS.labels(feed="space")._value.get()
    assert after == before + 1
