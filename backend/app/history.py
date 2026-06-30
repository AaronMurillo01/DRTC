"""Event history for replay / time-travel.

Every so often the ingest side records a frame: the threat index at that instant
plus a trimmed list of the located events. A client can then walk the frames to
scrub the map backward in time.

The default store is SQLite (stdlib, no server, works in-process), which keeps
the dev stack to one container. The same append-only schema maps directly onto
PostgreSQL / TimescaleDB for production durability and longer retention; point
DRTC_HISTORY_DB at a file for persistence across restarts.
"""

from __future__ import annotations

import json
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class FrameMeta:
    ts: int
    threat_index: int
    threat_level: int
    event_count: int


class HistoryStore(ABC):
    @abstractmethod
    def record(self, ts: int, threat_index: int, threat_level: int, events: list[dict]) -> None: ...

    @abstractmethod
    def frames(self, since: int | None = None, limit: int = 240) -> list[FrameMeta]: ...

    @abstractmethod
    def frame_events(self, at: int) -> list[dict]: ...

    def close(self) -> None:  # noqa: B027 - optional override
        """Release resources. No-op by default."""


class NullHistory(HistoryStore):
    def record(self, ts: int, threat_index: int, threat_level: int, events: list[dict]) -> None:
        return None

    def frames(self, since: int | None = None, limit: int = 240) -> list[FrameMeta]:
        return []

    def frame_events(self, at: int) -> list[dict]:
        return []


class SqliteHistory(HistoryStore):
    def __init__(self, path: str = ":memory:", retention_hours: float = 24.0) -> None:
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._retention_ms = int(retention_hours * 3600_000)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS frames ("
            "ts INTEGER PRIMARY KEY, idx INTEGER, lvl INTEGER, cnt INTEGER, events TEXT)"
        )
        self._conn.commit()

    def record(self, ts: int, threat_index: int, threat_level: int, events: list[dict]) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO frames (ts, idx, lvl, cnt, events) VALUES (?, ?, ?, ?, ?)",
            (ts, threat_index, threat_level, len(events), json.dumps(events)),
        )
        self._conn.execute("DELETE FROM frames WHERE ts < ?", (ts - self._retention_ms,))
        self._conn.commit()

    def frames(self, since: int | None = None, limit: int = 240) -> list[FrameMeta]:
        if since is not None:
            rows = self._conn.execute(
                "SELECT ts, idx, lvl, cnt FROM frames WHERE ts >= ? ORDER BY ts DESC LIMIT ?",
                (since, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT ts, idx, lvl, cnt FROM frames ORDER BY ts DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [FrameMeta(*r) for r in reversed(rows)]

    def frame_events(self, at: int) -> list[dict]:
        # The frame in effect at `at` is the most recent one at or before it.
        row = self._conn.execute(
            "SELECT events FROM frames WHERE ts <= ? ORDER BY ts DESC LIMIT 1", (at,)
        ).fetchone()
        if row is None:
            row = self._conn.execute(
                "SELECT events FROM frames ORDER BY ts ASC LIMIT 1"
            ).fetchone()
        return json.loads(row[0]) if row else []

    def close(self) -> None:
        self._conn.close()


def make_history(path: str | None) -> HistoryStore:
    # Default to an in-memory SQLite store so replay works out of the box; a path
    # gives durability, and the same schema ports to Postgres/TimescaleDB.
    return SqliteHistory(path or ":memory:")
