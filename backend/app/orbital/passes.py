"""Server-side SGP4 pass prediction over the ground-station network.

A faithful port of the frontend engine, but this is now the single source of
truth: it runs once on the backend and the result is fanned out to every client
instead of each browser recomputing it. Times are epoch milliseconds in and out
to match the frontend contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sgp4.api import Satrec, jday

from .geo import ecef_subpoint, gmst_rad, look_angle, teme_to_ecef
from .groundstations import GroundStation

BAND_MBPS: dict[str, float] = {"UHF": 0.0096, "S": 6, "X": 150, "Ku": 300, "Ka": 800}
BAND_GHZ: dict[str, float] = {"UHF": 0.43, "S": 2.25, "X": 8.2, "Ku": 12, "Ka": 26}
_C_KM_S = 299792.458


@dataclass(frozen=True)
class TrackedSat:
    id: int
    name: str
    line1: str
    line2: str


@dataclass(frozen=True)
class SatPosition:
    id: int
    name: str
    lat: float
    lng: float
    alt_km: float
    velocity_km_s: float


@dataclass(frozen=True)
class ContactWindow:
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


def _best_band(bands: tuple[str, ...]) -> tuple[str, float, float]:
    band = bands[0] if bands else "S"
    mbps = BAND_MBPS.get(band, 6)
    for b in bands:
        r = BAND_MBPS.get(b, 0)
        if r > mbps:
            mbps, band = r, b
    return band, mbps, BAND_GHZ.get(band, 2.25)


def build_satrec(sat: TrackedSat) -> Satrec | None:
    try:
        rec = Satrec.twoline2rv(sat.line1, sat.line2)
    except (ValueError, RuntimeError):
        return None
    return rec if rec.error == 0 else None


def _jd(ms: float) -> tuple[float, float]:
    dt = datetime.fromtimestamp(ms / 1000.0, tz=UTC)
    return jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)


def _ecef(rec: Satrec, ms: float) -> tuple[float, float, float] | None:
    jd, fr = _jd(ms)
    err, r, _v = rec.sgp4(jd, fr)
    if err != 0:
        return None
    return teme_to_ecef(r, gmst_rad(jd, fr))


def _elev(rec: Satrec, st: GroundStation, ms: float) -> float:
    ecef = _ecef(rec, ms)
    if ecef is None:
        return -90.0
    return look_angle(ecef, st.lat, st.lng).el_deg


def _range_km(rec: Satrec, st: GroundStation, ms: float) -> float | None:
    ecef = _ecef(rec, ms)
    if ecef is None:
        return None
    return look_angle(ecef, st.lat, st.lng).range_km


def _cross_time(rec: Satrec, st: GroundStation, mask: float, lo: float, hi: float) -> float:
    """Bisection for the elevation == mask crossing inside [lo, hi] (epoch ms)."""
    f_lo_neg = (_elev(rec, st, lo) - mask) < 0
    for _ in range(18):
        mid = (lo + hi) / 2
        if ((_elev(rec, st, mid) - mask) < 0) == f_lo_neg:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _culmination(rec: Satrec, st: GroundStation, lo: float, hi: float) -> float:
    """Ternary search for peak elevation time (a pass is unimodal in elevation)."""
    for _ in range(40):
        if hi - lo <= 500:
            break
        m1 = lo + (hi - lo) / 3
        m2 = hi - (hi - lo) / 3
        if _elev(rec, st, m1) < _elev(rec, st, m2):
            lo = m1
        else:
            hi = m2
    return _elev(rec, st, (lo + hi) / 2)


def _doppler_khz(rec: Satrec, st: GroundStation, ms: float, ghz: float) -> float:
    """Peak Doppler magnitude (kHz) from a numeric range rate near AOS."""
    r0 = _range_km(rec, st, ms - 500)
    r1 = _range_km(rec, st, ms + 500)
    if r0 is None or r1 is None:
        return 0.0
    rate_km_s = (r1 - r0) / 1.0  # 1 second baseline
    shift_hz = -(rate_km_s / _C_KM_S) * ghz * 1e9
    return abs(shift_hz) / 1000.0


def subpoint(sat: TrackedSat, ms: float) -> SatPosition | None:
    rec = build_satrec(sat)
    if rec is None:
        return None
    jd, fr = _jd(ms)
    err, r, v = rec.sgp4(jd, fr)
    if err != 0:
        return None
    lat, lon, h = ecef_subpoint(teme_to_ecef(r, gmst_rad(jd, fr)))
    if not all(map(_finite, (lat, lon, h))):
        return None
    speed = (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) ** 0.5
    return SatPosition(sat.id, sat.name, lat, lon, h, speed)


def sky_track(
    sat: TrackedSat, st: GroundStation, aos_ms: float, los_ms: float, n: int = 40
) -> list[tuple[float, float]]:
    rec = build_satrec(sat)
    if rec is None:
        return []
    out: list[tuple[float, float]] = []
    for i in range(n + 1):
        ms = aos_ms + (los_ms - aos_ms) * i / n
        ecef = _ecef(rec, ms)
        if ecef is None:
            continue
        la = look_angle(ecef, st.lat, st.lng)
        out.append((la.az_deg, max(0.0, la.el_deg)))
    return out


def _finite(x: float) -> bool:
    return x == x and x not in (float("inf"), float("-inf"))


def compute_passes(
    sats: list[TrackedSat],
    stations: list[GroundStation],
    now_ms: float,
    horizon_hours: float = 12.0,
    step_sec: float = 30.0,
) -> tuple[list[ContactWindow], list[SatPosition]]:
    step_ms = step_sec * 1000.0
    steps = int((horizon_hours * 3600.0) / step_sec)
    passes: list[ContactWindow] = []
    positions: list[SatPosition] = []

    obs = [(st, _best_band(st.bands)) for st in stations]

    for sat in sats:
        rec = build_satrec(sat)
        if rec is None:
            continue
        pos = subpoint(sat, now_ms)
        if pos is not None:
            positions.append(pos)

        open_pass: list[dict | None] = [None] * len(obs)
        prev_el: list[float] = [-90.0] * len(obs)

        for i in range(steps + 1):
            ms = now_ms + i * step_ms
            ecef = _ecef(rec, ms)
            if ecef is None:
                continue
            for s, (st, (band, mbps, ghz)) in enumerate(obs):
                la = look_angle(ecef, st.lat, st.lng)
                el, az = la.el_deg, la.az_deg
                above = el >= st.min_elev_deg
                was = prev_el[s] >= st.min_elev_deg
                o = open_pass[s]

                if above and o is None:
                    aos = _cross_time(rec, st, st.min_elev_deg, ms - step_ms, ms) if i > 0 else ms
                    open_pass[s] = {"aos": aos, "start_az": az, "last_az": az, "last_t": ms}
                elif above and o is not None:
                    o["last_az"] = az
                    o["last_t"] = ms
                elif (not above) and o is not None and was:
                    los = _cross_time(rec, st, st.min_elev_deg, o["last_t"], ms)
                    passes.append(_finalize(rec, sat, st, band, mbps, ghz, o, los, step_ms))
                    open_pass[s] = None
                elif (not above) and o is not None:
                    passes.append(_finalize(rec, sat, st, band, mbps, ghz, o, o["last_t"], step_ms))
                    open_pass[s] = None
                prev_el[s] = el

        for s, (st, (band, mbps, ghz)) in enumerate(obs):
            o = open_pass[s]
            if o is not None:
                passes.append(_finalize(rec, sat, st, band, mbps, ghz, o, o["last_t"], step_ms))

    passes.sort(key=lambda p: p.aos)
    return passes, positions


def _finalize(
    rec: Satrec,
    sat: TrackedSat,
    st: GroundStation,
    band: str,
    mbps: float,
    ghz: float,
    o: dict,
    los_raw: float,
    step_ms: float,
) -> ContactWindow:
    los = los_raw if los_raw > o["aos"] else o["aos"] + step_ms
    duration_sec = (los - o["aos"]) / 1000.0
    peak_el = max(_culmination(rec, st, o["aos"], los), st.min_elev_deg)
    return ContactWindow(
        id=f"pass-{sat.id}-{st.id}-{round(o['aos'])}",
        sat_id=sat.id,
        sat_name=sat.name,
        station_id=st.id,
        station_name=st.name,
        operator=st.operator,
        aos=o["aos"],
        los=los,
        duration_sec=duration_sec,
        max_elevation_deg=peak_el,
        start_az=o["start_az"],
        end_az=o["last_az"],
        band=band,
        downlink_mbps=mbps,
        volume_mb=(mbps * duration_sec) / 8.0,
        doppler_khz=_doppler_khz(rec, st, o["aos"], ghz),
    )


def active_contacts(passes: list[ContactWindow], now_ms: float) -> list[ContactWindow]:
    return [p for p in passes if p.aos <= now_ms <= p.los]
