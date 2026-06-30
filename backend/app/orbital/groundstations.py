"""Ground-station network (mirrors the frontend reference set)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class GroundStation:
    name: str
    operator: str
    lat: float
    lng: float
    bands: tuple[str, ...]
    min_elev_deg: float
    id: str = field(default="")

    def with_id(self) -> GroundStation:
        slug_op = re.sub(r"\W+", "", self.operator).lower()
        slug_name = re.sub(r"\W+", "", self.name).lower()
        return GroundStation(
            name=self.name,
            operator=self.operator,
            lat=self.lat,
            lng=self.lng,
            bands=self.bands,
            min_elev_deg=self.min_elev_deg,
            id=f"gs-{slug_op}-{slug_name}",
        )


_RAW: list[GroundStation] = [
    GroundStation("Svalbard (SvalSat)", "KSAT", 78.23, 15.39, ("S", "X", "Ka"), 5),
    GroundStation("TrollSat", "KSAT", -72.01, 2.53, ("S", "X"), 5),
    GroundStation("Tromso", "KSAT", 69.66, 18.94, ("S", "X"), 5),
    GroundStation("Punta Arenas", "KSAT", -52.94, -70.85, ("S", "X"), 5),
    GroundStation("Hartebeesthoek", "KSAT", -25.89, 27.69, ("S", "X"), 5),
    GroundStation("Mauritius", "KSAT", -20.31, 57.5, ("S", "X"), 5),
    GroundStation("Singapore", "KSAT", 1.39, 103.9, ("S", "X"), 7),
    GroundStation("Awarua", "KSAT", -46.53, 168.38, ("S", "X"), 5),
    GroundStation("Inuvik", "KSAT", 68.32, -133.55, ("S", "X"), 5),
    GroundStation("Leaf - Awarua", "Leaf Space", -46.52, 168.39, ("S", "X"), 8),
    GroundStation("Leaf - Cordoba", "Leaf Space", -31.52, -64.46, ("S", "X"), 8),
    GroundStation("Leaf - Azores", "Leaf Space", 37.74, -25.66, ("S", "X"), 8),
    GroundStation("Leaf - Svalbard", "Leaf Space", 78.22, 15.65, ("S", "X"), 8),
    GroundStation("RBC - Fairbanks", "RBC Signals", 64.86, -147.85, ("S", "X"), 5),
    GroundStation("RBC - Punta Arenas", "RBC Signals", -53.0, -70.86, ("S", "X"), 5),
    GroundStation("RBC - Brewster", "RBC Signals", 48.2, -119.68, ("S", "X"), 5),
    GroundStation("AWS - Ohio", "AWS GS", 39.96, -83.0, ("S", "X"), 5),
    GroundStation("AWS - Oregon", "AWS GS", 45.84, -119.7, ("S", "X"), 5),
    GroundStation("AWS - Stockholm", "AWS GS", 59.33, 18.07, ("S", "X"), 5),
    GroundStation("AWS - Bahrain", "AWS GS", 26.07, 50.56, ("S", "X"), 5),
    GroundStation("Wallops (WGS)", "NASA NEN", 37.95, -75.46, ("S", "X"), 5),
    GroundStation("Fairbanks (ASF)", "NASA NEN", 64.97, -147.51, ("S", "X"), 5),
    GroundStation("McMurdo (MG1)", "NASA NEN", -77.84, 166.67, ("S", "X"), 5),
    GroundStation("White Sands", "NASA NEN", 32.5, -106.61, ("S", "Ku"), 5),
    GroundStation("Kiruna (KIR)", "ESA Estrack", 67.86, 21.06, ("S", "X"), 5),
    GroundStation("Kourou (KRU)", "ESA Estrack", 5.25, -52.8, ("S", "X"), 5),
    GroundStation("New Norcia (NNO)", "ESA Estrack", -31.05, 116.19, ("S", "X"), 5),
    GroundStation("Atlas - Guam", "Atlas", 13.59, 144.86, ("S", "X"), 8),
    GroundStation("Atlas - Ghana", "Atlas", 5.66, -0.18, ("S", "X"), 8),
]

GROUND_STATIONS: list[GroundStation] = [s.with_id() for s in _RAW]
GROUND_OPERATORS: list[str] = list(dict.fromkeys(s.operator for s in GROUND_STATIONS))
