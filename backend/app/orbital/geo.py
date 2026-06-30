"""Geospatial + astrodynamics helpers for topocentric look angles.

The SGP4 propagator returns a TEME (true-equator, mean-equinox) state vector. To
turn that into what a ground station actually sees (azimuth, elevation, range) we
rotate TEME to an Earth-fixed frame by Greenwich Mean Sidereal Time, difference
against the observer's ECEF position, and project into the local SEZ frame.

Polar motion and nutation are ignored; for LEO pass planning the error is well
under the angular size of a dish beam.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# WGS-84
_A_KM = 6378.137
_E2 = 6.694379990141e-3
TWO_PI = 2.0 * math.pi


@dataclass(frozen=True)
class LookAngle:
    az_deg: float
    el_deg: float
    range_km: float


def gmst_rad(jd: float, fr: float) -> float:
    """Greenwich Mean Sidereal Time (radians) for a UT1 Julian date jd + fr."""
    t = (jd + fr - 2451545.0) / 36525.0
    gmst_sec = (
        67310.54841
        + (876600.0 * 3600.0 + 8640184.812866) * t
        + 0.093104 * t * t
        - 6.2e-6 * t * t * t
    )
    # 240 seconds of time per degree of rotation.
    deg = (gmst_sec % 86400.0) / 240.0
    return math.radians(deg) % TWO_PI


def geodetic_to_ecef(
    lat_deg: float, lon_deg: float, h_km: float = 0.0
) -> tuple[float, float, float]:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    sin_lat = math.sin(lat)
    n = _A_KM / math.sqrt(1.0 - _E2 * sin_lat * sin_lat)
    x = (n + h_km) * math.cos(lat) * math.cos(lon)
    y = (n + h_km) * math.cos(lat) * math.sin(lon)
    z = (n * (1.0 - _E2) + h_km) * sin_lat
    return x, y, z


def teme_to_ecef(r_teme: tuple[float, float, float], gmst: float) -> tuple[float, float, float]:
    cos_t = math.cos(gmst)
    sin_t = math.sin(gmst)
    x, y, z = r_teme
    return (cos_t * x + sin_t * y, -sin_t * x + cos_t * y, z)


def ecef_subpoint(r_ecef: tuple[float, float, float]) -> tuple[float, float, float]:
    """Geodetic latitude, longitude (deg) and height (km) of an ECEF point."""
    x, y, z = r_ecef
    lon = math.degrees(math.atan2(y, x))
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1.0 - _E2))  # initial guess
    for _ in range(5):
        sin_lat = math.sin(lat)
        n = _A_KM / math.sqrt(1.0 - _E2 * sin_lat * sin_lat)
        lat = math.atan2(z + _E2 * n * sin_lat, p)
    sin_lat = math.sin(lat)
    n = _A_KM / math.sqrt(1.0 - _E2 * sin_lat * sin_lat)
    h = p / math.cos(lat) - n
    return math.degrees(lat), lon, h


def look_angle(
    r_ecef_sat: tuple[float, float, float],
    obs_lat_deg: float,
    obs_lon_deg: float,
    obs_h_km: float = 0.0,
) -> LookAngle:
    """Azimuth/elevation/range from a ground station to a satellite (ECEF)."""
    obs = geodetic_to_ecef(obs_lat_deg, obs_lon_deg, obs_h_km)
    rx = r_ecef_sat[0] - obs[0]
    ry = r_ecef_sat[1] - obs[1]
    rz = r_ecef_sat[2] - obs[2]

    lat = math.radians(obs_lat_deg)
    lon = math.radians(obs_lon_deg)
    sin_lat, cos_lat = math.sin(lat), math.cos(lat)
    sin_lon, cos_lon = math.sin(lon), math.cos(lon)

    south = sin_lat * cos_lon * rx + sin_lat * sin_lon * ry - cos_lat * rz
    east = -sin_lon * rx + cos_lon * ry
    zenith = cos_lat * cos_lon * rx + cos_lat * sin_lon * ry + sin_lat * rz

    rng = math.sqrt(rx * rx + ry * ry + rz * rz)
    el = math.degrees(math.asin(max(-1.0, min(1.0, zenith / rng)))) if rng else -90.0
    az = (math.degrees(math.atan2(east, -south)) + 360.0) % 360.0
    return LookAngle(az_deg=az, el_deg=el, range_km=rng)
