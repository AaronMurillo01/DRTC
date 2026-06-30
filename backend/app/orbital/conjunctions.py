"""Conjunction screening: closest approaches between tracked objects.

A miniature space-domain-awareness task. Every tracked spacecraft is propagated
over a short horizon and screened pairwise; for each pair we find the time of
closest approach (TCA), the miss distance, and the relative speed. Real catalogs
screen tens of thousands of objects with smart pre-filters; here the catalog is
small, so a direct O(pairs x steps) sweep with a refined minimum is plenty.

Separation is computed in the TEME inertial frame the propagator already returns,
so no Earth-fixed rotation is needed (both objects share the same frame and time).
"""

from __future__ import annotations

from dataclasses import dataclass

from sgp4.api import Satrec

from .passes import TrackedSat, _jd, build_satrec

# A miss closer than this is flagged as a screening alert.
ALERT_KM = 25.0

Vec3 = tuple[float, float, float]


@dataclass(frozen=True)
class Conjunction:
    id: str
    a_id: int
    a_name: str
    b_id: int
    b_name: str
    tca: float  # epoch ms
    miss_km: float
    rel_speed_km_s: float
    alert: bool


def _state(rec: Satrec, ms: float) -> tuple[Vec3, Vec3] | None:
    jd, fr = _jd(ms)
    err, r, v = rec.sgp4(jd, fr)
    if err != 0:
        return None
    return r, v


def _sep_km(a: Vec3, b: Vec3) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def _refine_tca(rec_a: Satrec, rec_b: Satrec, lo: float, hi: float) -> tuple[float, float]:
    """Ternary search for minimum separation in [lo, hi] (epoch ms)."""
    for _ in range(40):
        if hi - lo <= 200:
            break
        m1 = lo + (hi - lo) / 3
        m2 = hi - (hi - lo) / 3
        sa1, sb1 = _state(rec_a, m1), _state(rec_b, m1)
        sa2, sb2 = _state(rec_a, m2), _state(rec_b, m2)
        if sa1 is None or sb1 is None or sa2 is None or sb2 is None:
            break
        if _sep_km(sa1[0], sb1[0]) < _sep_km(sa2[0], sb2[0]):
            hi = m2
        else:
            lo = m1
    t = (lo + hi) / 2
    sa, sb = _state(rec_a, t), _state(rec_b, t)
    if sa is None or sb is None:
        return t, float("inf")
    return t, _sep_km(sa[0], sb[0])


def screen_conjunctions(
    sats: list[TrackedSat],
    now_ms: float,
    horizon_hours: float = 6.0,
    step_sec: float = 60.0,
    top_k: int = 12,
) -> list[Conjunction]:
    step_ms = step_sec * 1000.0
    steps = int((horizon_hours * 3600.0) / step_sec)

    recs: list[tuple[TrackedSat, Satrec]] = []
    for s in sats:
        rec = build_satrec(s)
        if rec is not None:
            recs.append((s, rec))

    # Precompute each object's position track once.
    tracks: list[list[Vec3 | None]] = []
    for _s, rec in recs:
        pts: list[tuple[float, float, float] | None] = []
        for i in range(steps + 1):
            st = _state(rec, now_ms + i * step_ms)
            pts.append(st[0] if st is not None else None)
        tracks.append(pts)

    out: list[Conjunction] = []
    for i in range(len(recs)):
        for j in range(i + 1, len(recs)):
            best_idx = -1
            best_d = float("inf")
            for k in range(steps + 1):
                pa, pb = tracks[i][k], tracks[j][k]
                if pa is None or pb is None:
                    continue
                d = _sep_km(pa, pb)
                if d < best_d:
                    best_d, best_idx = d, k
            if best_idx < 0:
                continue
            lo = now_ms + max(0, best_idx - 1) * step_ms
            hi = now_ms + min(steps, best_idx + 1) * step_ms
            tca, miss = _refine_tca(recs[i][1], recs[j][1], lo, hi)

            sa, sb = _state(recs[i][1], tca), _state(recs[j][1], tca)
            rel = 0.0
            if sa is not None and sb is not None:
                rel = (
                    (sa[1][0] - sb[1][0]) ** 2
                    + (sa[1][1] - sb[1][1]) ** 2
                    + (sa[1][2] - sb[1][2]) ** 2
                ) ** 0.5

            a_sat, b_sat = recs[i][0], recs[j][0]
            out.append(
                Conjunction(
                    id=f"cdm-{a_sat.id}-{b_sat.id}-{round(tca)}",
                    a_id=a_sat.id,
                    a_name=a_sat.name,
                    b_id=b_sat.id,
                    b_name=b_sat.name,
                    tca=tca,
                    miss_km=miss,
                    rel_speed_km_s=rel,
                    alert=miss < ALERT_KM,
                )
            )

    out.sort(key=lambda c: c.miss_km)
    return out[:top_k]
